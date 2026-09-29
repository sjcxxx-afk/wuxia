#!/usr/bin/env node
"use strict";

/**
 * 把正式签名配置注入 expo prebuild 生成的 android/app/build.gradle。
 *
 * 背景：Expo / React Native 模板的 release buildType 默认复用 debug 签名
 * （signingConfig signingConfigs.debug）。改用自建 keystore 后必须把 release
 * 指向自己的 signingConfig，否则产出依然是调试签名包：既与正式包签名冲突、
 * 无法覆盖安装，也让"安装包更新"这条路径失效。
 *
 * 用法：
 *   node scripts/apply-release-signing.js                    # 缺密钥则跳过（本地调试友好）
 *   node scripts/apply-release-signing.js --require          # CI 用：缺密钥直接失败
 *   node scripts/apply-release-signing.js --gradle-file <路径>  # 指定目标文件（测试用）
 *
 * 依赖的环境变量：
 *   WUXIA_KEYSTORE_FILE
 *   WUXIA_KEYSTORE_PASSWORD
 *   WUXIA_KEY_ALIAS
 *   WUXIA_KEY_PASSWORD
 */

const fs = require("fs");
const path = require("path");

const MARKER_BEGIN =
  "// >>> wuxia-release-signing (injected by scripts/apply-release-signing.js) >>>";
const MARKER_END = "// <<< wuxia-release-signing <<<";
const DEFAULT_GRADLE_FILE = path.join("android", "app", "build.gradle");

const ENV = {
  keystoreFile: "WUXIA_KEYSTORE_FILE",
  storePassword: "WUXIA_KEYSTORE_PASSWORD",
  keyAlias: "WUXIA_KEY_ALIAS",
  keyPassword: "WUXIA_KEY_PASSWORD",
};

/**
 * 从 openBraceIndex 指向的 '{' 开始做括号配对，返回闭合 '}' 的下标。
 * 模板文件里没有会影响配对的字符串/注释，故不做词法处理。
 */
function findBlockEnd(source, openBraceIndex) {
  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function signingBlock() {
  return [
    `        ${MARKER_BEGIN}`,
    "        release {",
    `            storeFile file(System.getenv("${ENV.keystoreFile}"))`,
    `            storePassword System.getenv("${ENV.storePassword}")`,
    `            keyAlias System.getenv("${ENV.keyAlias}")`,
    `            keyPassword System.getenv("${ENV.keyPassword}")`,
    "        }",
    `        ${MARKER_END}`,
  ].join("\n");
}

/**
 * 纯函数：返回 { changed, reason, output }。不读环境变量、不碰文件系统，便于单测。
 */
function applyReleaseSigning(source) {
  if (source.includes(MARKER_BEGIN)) {
    return { changed: false, reason: "already-patched", output: source };
  }

  const signingConfigsIndex = source.indexOf("signingConfigs {");
  if (signingConfigsIndex === -1) {
    throw new Error(
      "android/app/build.gradle 中找不到 signingConfigs 块，模板结构可能已变化"
    );
  }
  const signingConfigsOpen = source.indexOf("{", signingConfigsIndex);
  const signingConfigsClose = findBlockEnd(source, signingConfigsOpen);
  if (signingConfigsClose === -1) {
    throw new Error("signingConfigs 块括号不配对");
  }
  const signingConfigsBody = source.slice(signingConfigsOpen, signingConfigsClose);
  if (/^\s*release\s*\{/m.test(signingConfigsBody)) {
    return {
      changed: false,
      reason: "template-already-has-release-signing",
      output: source,
    };
  }

  const buildTypesIndex = source.indexOf("buildTypes {");
  if (buildTypesIndex === -1) {
    throw new Error("android/app/build.gradle 中找不到 buildTypes 块");
  }
  const releaseIndex = source.indexOf("release {", buildTypesIndex);
  if (releaseIndex === -1) {
    throw new Error("buildTypes 中找不到 release 块");
  }
  const releaseOpen = source.indexOf("{", releaseIndex);
  const releaseClose = findBlockEnd(source, releaseOpen);
  if (releaseClose === -1) {
    throw new Error("release 块括号不配对");
  }

  const releaseBody = source.slice(releaseOpen, releaseClose);
  const debugSigningPattern = /signingConfig\s+signingConfigs\.debug/;
  if (!debugSigningPattern.test(releaseBody)) {
    throw new Error(
      "release 块中找不到 `signingConfig signingConfigs.debug`，模板结构可能已变化（避免误改，已中止）"
    );
  }

  // 两处编辑：先改后面的 release 块，再插入前面的 signingConfigs，避免下标位移。
  const edits = [
    {
      start: releaseOpen,
      end: releaseClose,
      text: releaseBody.replace(
        debugSigningPattern,
        "signingConfig signingConfigs.release"
      ),
    },
    {
      start: signingConfigsOpen + 1,
      end: signingConfigsOpen + 1,
      text: "\n" + signingBlock(),
    },
  ].sort((a, b) => b.start - a.start);

  let output = source;
  for (const edit of edits) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  }
  return { changed: true, reason: "patched", output };
}

function parseArgs(argv) {
  const requireSecrets = argv.includes("--require");
  const fileFlagIndex = argv.indexOf("--gradle-file");
  const gradleFile =
    fileFlagIndex !== -1 && argv[fileFlagIndex + 1]
      ? argv[fileFlagIndex + 1]
      : DEFAULT_GRADLE_FILE;
  return { requireSecrets, gradleFile };
}

function main() {
  const { requireSecrets, gradleFile } = parseArgs(process.argv.slice(2));

  const skipOrFail = (message) => {
    if (requireSecrets) {
      console.error(`[apply-release-signing] 失败：${message}`);
      process.exit(1);
    }
    console.warn(`[apply-release-signing] 跳过签名注入：${message}`);
    process.exit(0);
  };

  const missing = Object.values(ENV).filter(
    (key) => !process.env[key] || process.env[key].trim() === ""
  );
  if (missing.length > 0) {
    skipOrFail(`缺少环境变量 ${missing.join(", ")}`);
  }

  const keystoreFile = process.env[ENV.keystoreFile];
  if (!fs.existsSync(keystoreFile)) {
    skipOrFail(`keystore 文件不存在：${keystoreFile}`);
  }
  if (!fs.existsSync(gradleFile)) {
    console.error(
      `[apply-release-signing] 失败：找不到 ${gradleFile}（请先执行 npx expo prebuild --platform android）`
    );
    process.exit(1);
  }

  const source = fs.readFileSync(gradleFile, "utf8");
  let result;
  try {
    result = applyReleaseSigning(source);
  } catch (error) {
    console.error(`[apply-release-signing] 失败：${error.message}`);
    process.exit(1);
  }

  if (!result.changed) {
    if (result.reason === "already-patched") {
      console.log("[apply-release-signing] 已注入过 release 签名，跳过");
      process.exit(0);
    }
    console.error(
      `[apply-release-signing] 失败：${result.reason}（需要人工确认模板是否已自带 release 签名）`
    );
    process.exit(1);
  }

  fs.writeFileSync(gradleFile, result.output);
  console.log(
    `[apply-release-signing] 已注入 release 签名：release buildType 指向 signingConfigs.release（keystore: ${keystoreFile}）`
  );
}

if (require.main === module) {
  main();
}

module.exports = { applyReleaseSigning, findBlockEnd, ENV, MARKER_BEGIN, MARKER_END };
