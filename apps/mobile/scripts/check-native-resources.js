/**
 * 原生资源引用守卫 —— 在 `npm run check` 阶段拦截 AAPT2 链接失败。
 *
 * 背景（真实事故）：v2.0.0 首次出包时 release 构建挂在
 *   :app:processReleaseResources
 *   error: resource drawable/splashscreen_logo not found
 *
 * 根因不是配置写错，而是 expo-splash-screen 的 config plugin 自身的不对称：
 *   - withAndroidSplashStyles.js **无条件**往 styles.xml 写
 *     `@drawable/splashscreen_logo`
 *   - 而 withAndroidSplashImages.js 只在**配了 image 时**才生成该 drawable
 *     （源码注释原文："If path isn't provided then no new image is placed"）
 *
 * 于是「省略 image」这个看起来最干净的做法，必然产出一次资源链接失败。
 * 本脚本把这条约束固化成断言，避免下次再踩。
 */
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/* ------------------------------------------------------------ 检查 A */

/**
 * splash 配置必须带 image。
 * 不是审美要求，是硬性约束：省略它会让 styles.xml 引用一个不存在的 drawable。
 */
function checkSplashConfig(config) {
  const problems = [];
  const notes = [];
  const plugins = (config.expo && config.expo.plugins) || [];
  const entry = plugins.find((p) =>
    Array.isArray(p) ? p[0] === "expo-splash-screen" : p === "expo-splash-screen",
  );

  if (!entry) {
    problems.push(
      "app.json 的 plugins 里没有 expo-splash-screen。" +
        "若确实要移除，必须同时确认 android 侧的 windowSplashScreen* 引用也被清掉，" +
        "否则同样会资源链接失败。",
    );
    return { problems, notes };
  }

  const opts = Array.isArray(entry) ? entry[1] || {} : {};

  for (const pair of [
    ["splash", opts],
    ["splash.dark", opts.dark || {}],
  ]) {
    const scope = pair[0];
    const o = pair[1];
    if (!o.image) {
      problems.push(
        "app.json 的 " + scope + " 缺少 image。" +
          "expo-splash-screen 会无条件把 @drawable/splashscreen_logo 写进 styles.xml，" +
          "省略 image 则该 drawable 不会被生成，release 构建会在资源链接阶段失败" +
          "（AAPT2 resource ... splashscreen_logo not found）。",
      );
      continue;
    }
    const abs = path.join(projectRoot, o.image);
    if (!fs.existsSync(abs)) {
      problems.push("app.json 的 " + scope + ".image 指向的文件不存在：" + o.image);
    }
  }

  // 防「方块套方块」复发：启动图不能是满幅应用图标
  const iconRel = (config.expo && config.expo.icon) || "";
  const iconPath = iconRel ? path.join(projectRoot, iconRel) : null;
  const splashImg = opts.image ? path.join(projectRoot, opts.image) : null;
  if (iconPath && splashImg && fs.existsSync(iconPath) && fs.existsSync(splashImg)) {
    if (fs.readFileSync(iconPath).equals(fs.readFileSync(splashImg))) {
      problems.push(
        "splash.image 与 app.json 的 icon 是同一个文件。" +
          "满幅图标被当作启动图压在纯色底上会显示成一个带圆角的方块（即「方块套方块」）。" +
          "启动图必须是透明底的标记。",
      );
    }
  }

  return { problems, notes };
}

/* ------------------------------------------------------------ 检查 B */

const REF_RE = /@(drawable|color|style|mipmap)\/([A-Za-z0-9_]+)/g;

/** 收集 res/ 下实际存在的资源名。drawable-xhdpi/foo.png 也算 @drawable/foo */
function collectAvailable(resDir) {
  const available = new Set();
  for (const dir of fs.readdirSync(resDir)) {
    const kind = dir.split("-")[0];
    if (["drawable", "color", "style", "mipmap"].indexOf(kind) === -1) continue;
    for (const f of fs.readdirSync(path.join(resDir, dir))) {
      available.add(kind + "/" + f.replace(/\.(xml|png|webp|jpg)$/i, ""));
    }
  }
  // values/ 里定义的 style / color
  const valuesDirs = fs
    .readdirSync(resDir)
    .filter((d) => d === "values" || d.startsWith("values-"));
  for (const vd of valuesDirs) {
    const full = path.join(resDir, vd);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const f of fs.readdirSync(full)) {
      if (!f.endsWith(".xml")) continue;
      const src = fs.readFileSync(path.join(full, f), "utf8");
      for (const m of src.matchAll(/<color\s+name="([^"]+)"/g)) {
        available.add("color/" + m[1]);
      }
      for (const m of src.matchAll(/<style\s+name="([^"]+)"/g)) {
        available.add("style/" + m[1]);
      }
    }
  }
  return available;
}

/**
 * 校验 prebuild 产物里各个 values 目录下的 xml 资源引用是否都能解析。
 * 只在 android/ 已存在时有效（CI 的 npm ci 阶段还没有 android/）。
 */
function checkPrebuiltResources(resDir) {
  const problems = [];
  const notes = [];

  if (!fs.existsSync(resDir)) {
    notes.push("跳过：尚未 prebuild，android/app/src/main/res 不存在");
    return { problems, notes };
  }

  const available = collectAvailable(resDir);
  notes.push("已扫描 " + available.size + " 个资源");

  for (const dir of fs.readdirSync(resDir)) {
    if (dir !== "values" && !dir.startsWith("values-")) continue;
    const full = path.join(resDir, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const f of fs.readdirSync(full)) {
      if (!f.endsWith(".xml")) continue;
      const src = fs.readFileSync(path.join(full, f), "utf8");
      REF_RE.lastIndex = 0;
      let m;
      while ((m = REF_RE.exec(src)) !== null) {
        const ref = m[1] + "/" + m[2];
        if (!available.has(ref)) {
          problems.push(
            dir + "/" + f + " 引用了不存在的资源 " + ref +
              "（AAPT2 会报 resource " + ref + " not found）",
          );
        }
      }
    }
  }

  return { problems, notes };
}

function collectProblems() {
  const config = readJson(path.join(projectRoot, "app.json"));
  const a = checkSplashConfig(config);
  const b = checkPrebuiltResources(path.join(projectRoot, "android/app/src/main/res"));
  return {
    problems: a.problems.concat(b.problems),
    notes: a.notes.concat(b.notes),
  };
}

function main() {
  const r = collectProblems();
  for (const n of r.notes) console.log("[native-resources] note: " + n);
  if (r.problems.length) {
    console.error("[native-resources] 原生资源引用会导致 AAPT2 链接失败：");
    for (const p of r.problems) console.error("  x " + p);
    return 1;
  }
  console.log("[native-resources] 通过：splash 配置自洽，资源引用均可解析。");
  return 0;
}

module.exports = {
  checkSplashConfig,
  checkPrebuiltResources,
  collectAvailable,
  collectProblems,
};

if (require.main === module) {
  process.exit(main());
}
