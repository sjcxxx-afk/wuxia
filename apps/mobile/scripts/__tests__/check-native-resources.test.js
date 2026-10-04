const { checkSplashConfig, collectAvailable } = require("../check-native-resources");
const fs = require("fs");
const os = require("os");
const path = require("path");

/** 造一个最小 app.json 配置对象 */
function cfg(plugins, icon) {
  return { expo: { icon, plugins } };
}

describe("checkSplashConfig", () => {
  // 回归测试：v2.0.0 的真实事故。省略 image 会让 AAPT2 找不到
  // drawable/splashscreen_logo，release 构建挂在 processReleaseResources。
  it("拦截省略 image 的 splash 配置（本次线上事故的根因）", () => {
    const r = checkSplashConfig(cfg([["expo-splash-screen", { backgroundColor: "#F2EDE4" }]]));
    expect(r.problems.join()).toMatch(/splashscreen_logo/);
    expect(r.problems.join()).toMatch(/缺少 image/);
  });

  it("拦截 dark 子配置省略 image", () => {
    const r = checkSplashConfig(
      cfg([["expo-splash-screen", { image: "./assets/splash-mark.png", dark: { backgroundColor: "#000" } }]]),
    );
    expect(r.problems.join()).toMatch(/splash\.dark 缺少 image/);
  });

  it("拦截 image 指向不存在的文件", () => {
    const r = checkSplashConfig(cfg([["expo-splash-screen", { image: "./assets/nope.png" }]]));
    expect(r.problems.join()).toMatch(/指向的文件不存在/);
  });

  it("拦截「方块套方块」复发：splash.image 与 icon 同文件", () => {
    const real = path.resolve(__dirname, "../../assets/icon.png");
    const splash = path.resolve(__dirname, "../../assets/splash-mark.png");
    if (!fs.existsSync(real) || !fs.existsSync(splash)) {
      // 图标尚未生成时本用例无意义
      expect(fs.existsSync(real)).toBe(false);
      return;
    }
    const r = checkSplashConfig(
      cfg([["expo-splash-screen", { image: "./assets/icon.png" }]], "./assets/icon.png"),
    );
    expect(r.problems.join()).toMatch(/方块套方块/);
  });

  it("拦截整个 expo-splash-screen 插件被移除", () => {
    const r = checkSplashConfig(cfg([["expo-router"]]));
    expect(r.problems.join()).toMatch(/没有 expo-splash-screen/);
  });

  it("当前仓库的实际配置必须通过", () => {
    const real = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../../app.json"), "utf8"),
    );
    const r = checkSplashConfig(real);
    expect(r.problems).toEqual([]);
  });
});

describe("collectAvailable", () => {
  it("drawable-xhdpi/foo.png 也能解析为 @drawable/foo", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "res-"));
    fs.mkdirSync(path.join(dir, "drawable-xhdpi"));
    fs.writeFileSync(path.join(dir, "drawable-xhdpi", "foo.png"), "x");
    expect(collectAvailable(dir).has("drawable/foo")).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("values/ 里定义的 color 与 style 计入可解析集合", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "res-"));
    fs.mkdirSync(path.join(dir, "values"));
    fs.writeFileSync(
      path.join(dir, "values", "colors.xml"),
      '<resources><color name="splashscreen_background">#fff</color></resources>',
    );
    fs.writeFileSync(
      path.join(dir, "values", "styles.xml"),
      '<resources><style name="AppTheme"></style></resources>',
    );
    const set = collectAvailable(dir);
    expect(set.has("color/splashscreen_background")).toBe(true);
    expect(set.has("style/AppTheme")).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
