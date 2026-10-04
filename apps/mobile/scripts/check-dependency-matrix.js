#!/usr/bin/env node
/**
 * 依赖矩阵守卫 —— 防止 package.json / package-lock 漂离 Expo SDK 56 的官方版本矩阵。
 *
 * 为什么要守（2026-10 那次「装完点开即闪退」的根因就是这里）：
 *   1. RN 自带的 renderer 在模块加载时硬性断言 react 版本完全一致
 *      （node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-prod.js），
 *      不一致时直接 `throw Error('Incompatible React versions...')`。
 *      debug 下表现为红屏，release 包里没有错误浮层 —— 就是点开即闪退。
 *   2. expo-* / react-native-* 包跨 SDK 大版本安装（例如 SDK 56 里装 expo-secure-store 57、
 *      gesture-handler 3.x），其原生代码是按另一个 SDK 编译的，属于未受支持组合。
 *   3. 原生模块在 node_modules 里出现两份不同版本时，autolinking 只会把其中一份编进 APK，
 *      而 Metro 会把 expo-router 解析到的那一份打进 JS bundle —— JS 与原生对不上。
 *
 * CLI 用法：node scripts/check-dependency-matrix.js   （退出码 0 = 通过，1 = 有漂移）
 * 逻辑部分是纯函数，便于在 scripts/__tests__ 里用夹具测试。
 */
const fs = require("fs");
const path = require("path");

/** RN renderer 里形如：if ("19.2.3" !== isomorphicReactPackageVersion) throw Error(...) */
const REACT_PIN_RE = /if \("([\d.]+)" !== isomorphicReactPackageVersion\)/;

/** 会被 autolinking 编成原生代码的模块：装成两份就一定有一份是白打的 */
const NATIVE_MODULES = [
  "react-native-screens",
  "react-native-gesture-handler",
  "react-native-reanimated",
  "react-native-worklets",
  "react-native-safe-area-context",
  "expo-modules-core",
];

/** 1. react 必须与 RN renderer 内置断言的版本完全一致 */
function checkReactRendererPin({ rendererSources, reactVersion }) {
  const problems = [];
  const required = new Set();
  for (const src of rendererSources) {
    const m = String(src).match(REACT_PIN_RE);
    if (m) required.add(m[1]);
  }
  if (required.size === 0) {
    return { problems, note: "跳过 react 断言检查：renderer 里没有找到版本断言" };
  }
  const wanted = [...required];
  if (wanted.length > 1) {
    problems.push(
      `react-native renderer 之间断言版本不一致：${wanted.join(", ")}（RN 包本身有问题）`,
    );
    return { problems };
  }
  if (reactVersion !== wanted[0]) {
    problems.push(
      `react@${reactVersion} 与 react-native renderer 要求的 react@${wanted[0]} 不一致 ` +
        `—— 运行时会 throw "Incompatible React versions"，release 包表现为启动闪退`,
    );
  }
  return { problems };
}

/** 2. 已安装包的 SDK 大版本必须与 expo 的官方矩阵一致（补丁号漂移不算问题） */
function checkSdkMajorLines({ matrix, installed }) {
  const problems = [];
  for (const [name, expectedRange] of Object.entries(matrix)) {
    const actual = installed[name];
    if (!actual) continue; // 没装就不管
    const expectedMin = String(expectedRange).replace(/^[\^~>=<\s]+/, "");
    const [expMajor, expMinor] = expectedMin.split(".").map(Number);
    const [actMajor, actMinor] = actual.split(".").map(Number);
    // 0.x 包用 minor 当「大版本」，其余用 major
    const sameLine =
      expMajor === 0
        ? expMajor === actMajor && expMinor === actMinor
        : expMajor === actMajor;
    if (!sameLine) {
      problems.push(
        `${name}@${actual} 跨了 SDK 大版本（expo 期望 ${expectedRange}）` +
          `—— 原生代码按另一个 SDK 编译，属于未受支持组合`,
      );
    }
  }
  return { problems };
}

/** 3. 原生模块不得在 node_modules 里出现两份不同版本 */
function checkDuplicatedNativeModules({ lockPackages }) {
  const problems = [];
  const seen = new Map();
  for (const [key, entry] of Object.entries(lockPackages || {})) {
    if (!key.startsWith("node_modules/")) continue;
    const bare = key.split("node_modules/").pop();
    if (!NATIVE_MODULES.includes(bare)) continue;
    if (!seen.has(bare)) seen.set(bare, []);
    seen.get(bare).push(`${key.replace(/^node_modules\//, "")}@${entry.version}`);
  }
  for (const [bare, copies] of seen) {
    const versions = new Set(copies.map((c) => c.split("@").pop()));
    if (versions.size > 1) {
      problems.push(
        `${bare} 被安装成了多份不同版本：${copies.join(" | ")} ` +
          `—— 只有一份会被编进 APK，另一份却会进 JS bundle，JS 与原生对不上`,
      );
    }
  }
  return { problems };
}

function collectProblems(input) {
  const problems = [];
  const notes = [];
  for (const check of [
    checkReactRendererPin,
    checkSdkMajorLines,
    checkDuplicatedNativeModules,
  ]) {
    const r = check(input);
    problems.push(...r.problems);
    if (r.note) notes.push(r.note);
  }
  return { problems, notes };
}

/** 从真实仓库里读出各检查所需的输入 */
function readEnvironment(projectRoot) {
  const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
  const rendererDir = path.join(
    projectRoot,
    "node_modules/react-native/Libraries/Renderer/implementations",
  );
  const rendererSources = fs.existsSync(rendererDir)
    ? fs
        .readdirSync(rendererDir)
        .filter((f) => f.endsWith(".js"))
        .map((f) => fs.readFileSync(path.join(rendererDir, f), "utf8"))
    : [];

  const matrixPath = path.join(
    projectRoot,
    "node_modules/expo/bundledNativeModules.json",
  );
  const matrix = fs.existsSync(matrixPath) ? readJson(matrixPath) : {};

  const installed = {};
  if (matrixPath) {
    for (const name of Object.keys(matrix)) {
      const p = path.join(projectRoot, "node_modules", ...name.split("/"), "package.json");
      if (fs.existsSync(p)) installed[name] = readJson(p).version;
    }
  }
  const reactPkg = path.join(projectRoot, "node_modules/react/package.json");
  const reactVersion = fs.existsSync(reactPkg) ? readJson(reactPkg).version : null;

  const lockPath = path.join(projectRoot, "package-lock.json");
  const lockPackages = fs.existsSync(lockPath) ? readJson(lockPath).packages || {} : {};

  return { rendererSources, reactVersion, matrix, installed, lockPackages };
}

function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const { problems, notes } = collectProblems(readEnvironment(projectRoot));
  for (const n of notes) console.log(`[dependency-matrix] note: ${n}`);
  if (problems.length > 0) {
    console.error("[dependency-matrix] 依赖矩阵漂移，会直接导致 release 包启动闪退：");
    for (const p of problems) console.error(`  ✗ ${p}`);
    console.error(
      "\n修复：把这些包改回 expo 官方矩阵版本（npx expo install --check 会列出期望值），" +
        "然后 npm install 重新生成 package-lock.json。",
    );
    return 1;
  }
  console.log(
    "[dependency-matrix] 通过：react 版本与 renderer 一致，SDK 大版本与原生模块均无重复。",
  );
  return 0;
}

module.exports = {
  REACT_PIN_RE,
  NATIVE_MODULES,
  checkReactRendererPin,
  checkSdkMajorLines,
  checkDuplicatedNativeModules,
  collectProblems,
  readEnvironment,
};

if (require.main === module) {
  process.exit(main());
}
