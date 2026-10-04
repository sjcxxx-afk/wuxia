const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

// 用真实文件做探针：worklets 插件会从磁盘读源文件来生成 worklet 字符串，
// 所以 filename 必须指向真实存在的文件。
const TARGET = path.join(__dirname, "..", "components", "InkSplash.tsx");

function main() {
  const src = fs.readFileSync(TARGET, "utf8");
  const out = babel.transformSync(src, {
    filename: TARGET,
    cwd: path.join(__dirname, ".."),
    root: path.join(__dirname, ".."),
    configFile: path.join(__dirname, "..", "babel.config.js"),
  });
  const code = out.code;
  const hasHash = code.includes("__workletHash");
  const hasInit = code.includes("__initData");
  console.log("[probe] 目标文件: " + path.relative(path.join(__dirname, ".."), TARGET));
  console.log("[probe] 产物含 __workletHash : " + hasHash);
  console.log("[probe] 产物含 __initData     : " + hasInit);
  if (hasHash) {
    const n = (code.match(/__workletHash/g) || []).length;
    console.log("[probe] worklet 数量: " + n);
  }
  if (!hasHash) {
    console.error("[probe] 失败：worklets 插件未生效，Reanimated 4 运行时会崩。");
    return 1;
  }
  console.log("[probe] 通过：worklet 已正确改写。");
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { TARGET, main };
