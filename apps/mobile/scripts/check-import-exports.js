/**
 * 本地导入/导出一致性守卫。
 *
 * 排查思路：release 包里 JS 崩溃没有任何浮层（debug 有红屏，release 没有），
 * 表现就是「装上能开、但停在启动页」——因为 app/_layout.tsx 已在模块顶层调用
 * SplashScreen.preventAutoHideAsync()，只要渲染树里任何一处抛错，
 * 负责隐藏原生页的 InkSplash 也会被一起卸载，原生页就永远留在屏幕上。
 *
 * TypeScript 能挡住「导入了不存在的东西」，但**挡不住运行时的意外**：
 *  - 默认参数在渲染期求值：`tile = textureTile.paper`，若 textureTile 为 undefined 就抛
 *  - 模块顶层的表达式：`wood.grain.map(...)` 在 import 时就抛
 *  这两类都会让整棵树挂掉。本脚本把「本项目内部模块」的具名导入逐个核对一遍，
 * 属于同一类问题的静态兜底。
 */
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const SRC_DIRS = ["app", "components", "lib"];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** 收集一个模块导出的所有名字（值导出 + type 导出） */
function collectExports(abs) {
  const src = fs.readFileSync(abs, "utf8");
  const names = new Set();
  const push = (n) => n && names.add(n);

  // export [default] [async] const/let/var/function/class/interface/type/enum
  // 注意 async / default / declare 这些修饰符必须都放行，
  // 否则 `export async function loadData` 这类会被整批漏掉（假阳性满屏）。
  const decl =
    /export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/g;
  let m;
  while ((m = decl.exec(src)) !== null) push(m[1]);

  // export { a, b as c }
  const braced = /export\s*(?:type\s*)?\{([^}]*)\}/g;
  while ((m = braced.exec(src)) !== null) {
    for (const part of m[1].split(",")) {
      const t = part.trim();
      if (!t) continue;
      const as = t.split(/\s+as\s+/);
      push((as[1] || as[0]).trim());
    }
  }

  // export default ...（不参与具名导入核对，但记下来）
  if (/export\s+default/.test(src)) push("default");
  return names;
}

/** 解析文件里的 import 语句 → [{ spec, names: [...] }] */
function collectImports(src) {
  const out = [];
  const re = /import\s+(type\s+)?([^;]*?)\s+from\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const clause = m[2].trim();
    const spec = m[3];
    if (!spec.startsWith(".")) continue; // 只核对项目内部模块
    const names = [];
    const braced = clause.match(/\{([^}]*)\}/);
    if (braced) {
      for (const part of braced[1].split(",")) {
        // `import { type Foo }` 里的 type 只是修饰符，名字是 Foo
        const t = part.trim().replace(/^type\s+/, "");
        if (!t) continue;
        const as = t.split(/\s+as\s+/);
        names.push({ imported: as[0].trim(), local: as[1] || as[0] });
      }
    }
    const def = clause.replace(/\{[^}]*\}/, "").replace(/^\s*,|,\s*$/g, "").trim();
    if (def && !def.startsWith("*")) names.push({ imported: "default", local: def });
    out.push({ spec, names });
  }
  return out;
}

function resolve(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const cand of [base + ".ts", base + ".tsx", path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (fs.existsSync(cand)) return cand;
  }
  return null;
}

function collectProblems() {
  const problems = [];
  let checked = 0;

  for (const dir of SRC_DIRS) {
    const base = path.join(projectRoot, dir);
    if (!fs.existsSync(base)) continue;
    for (const abs of walk(base)) {
      const rel = path.relative(projectRoot, abs).replace(/\\/g, "/");
      const src = fs.readFileSync(abs, "utf8");
      for (const imp of collectImports(src)) {
        const target = resolve(abs, imp.spec);
        if (!target) {
          problems.push(rel + " 引用了不存在的模块 " + imp.spec);
          continue;
        }
        const exports = collectExports(target);
        for (const n of imp.names) {
          checked++;
          if (!exports.has(n.imported)) {
            problems.push(
              rel + " 从 " + imp.spec + " 导入了 " + n.imported +
                "，但该模块没有导出它（导出：" + [...exports].sort().join(", ") + "）",
            );
          }
        }
      }
    }
  }
  return { problems, checked };
}

function main() {
  const { problems, checked } = collectProblems();
  if (problems.length) {
    console.error("[import-exports] 本地导入与导出不匹配（会导致启动期渲染崩溃，release 无浮层）：");
    for (const p of problems) console.error("  x " + p);
    return 1;
  }
  console.log("[import-exports] 通过：核对 " + checked + " 个本地具名导入，全部有对应导出。");
  return 0;
}

module.exports = { collectExports, collectImports, resolve, collectProblems };

if (require.main === module) {
  process.exit(main());
}
