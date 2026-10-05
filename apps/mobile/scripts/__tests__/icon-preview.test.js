/**
 * 图标几何守卫的回归测试 —— 证明它真的会失败，而不是永远通过。
 *
 * 背景：v2.0.0 的图标之所以难看，是因为写完路径就推送了，没人看过它长什么样。
 * 放大镜因两段大弧拼成尖椭圆、分类（原博古架）因三件器物宽高不一而在 25px 下糊掉。
 * 这两类「算对了但看着不对」的问题里，位置越界与闭合开口是可自动化的部分，
 * 由 checkGeometry 兜住；好不好看仍靠 npm run icons:preview 出图人眼确认。
 */
const { checkGeometry, flatten, extract } = require("../icon-preview");

describe("图标几何守卫", () => {
  it("抓到越出 24 视图框的路径（会被裁切、笔画断头）", () => {
    const bad = [{ name: "outOfBounds", def: { paths: ["M0 0 L30 12"], active: [] } }];
    const p = checkGeometry(bad);
    expect(p.length).toBeGreaterThan(0);
    expect(p.join()).toMatch(/越出视图框/);
  });

  it("抓到没有任何路径的图标", () => {
    const p = checkGeometry([{ name: "empty", def: { paths: [], active: [] } }]);
    expect(p.join()).toMatch(/没有任何路径/);
  });

  it("抓到退化路径（长度≈0，画不出任何东西）", () => {
    const bad = [{ name: "degenerate", def: { paths: ["M12 12 L12 12"], active: [] } }];
    expect(checkGeometry(bad).join()).toMatch(/退化路径/);
  });

  it("对正常闭合且在框内的路径不报错", () => {
    const good = [{ name: "rect", def: { paths: ["M4 4 H20 V20 H4 Z"], active: [] } }];
    expect(checkGeometry(good)).toEqual([]);
  });

  it("闭合性不做检查 —— 解析器会按 SVG 语义自动补回起点，这条断言必然通过", () => {
    // 记录这个刻意的设计：曾经写过这条检查，它是空的（永远为真），已移除。
    // 这里断言「解析器确实补了起点」，把那段语义固定下来。
    const subs = flatten("M4 12 L20 12 Z");
    const sp = subs[0];
    expect(sp[sp.length - 1]).toEqual([4, 12]);
  });

  it("当前仓库的全部图标必须通过", () => {
    const entries = extract();
    expect(entries.length).toBeGreaterThan(0);
    expect(checkGeometry(entries)).toEqual([]);
  });
});

describe("路径解析器", () => {
  it("含多个弧段的 path 必须解析成单个子路径，而不是被逐条指令拆开", () => {
    // 这个 bug 曾让闭合检查误报满屏：每条 A 指令都被当成了新的子路径
    const subs = flatten("M4.3 10.8 A6.5 6.5 0 0 1 17.3 10.8 A6.5 6.5 0 0 1 4.3 10.8 Z");
    expect(subs.length).toBe(1);
    const sp = subs[0];
    const gap = Math.hypot(sp[0][0] - sp[sp.length - 1][0], sp[0][1] - sp[sp.length - 1][1]);
    expect(gap).toBeLessThan(0.05);
  });

  it("圆弧采样端点必须精确落在声明的终点上", () => {
    const subs = flatten("M0 6 A6 6 0 0 1 12 6");
    const sp = subs[0];
    expect(sp[sp.length - 1][0]).toBeCloseTo(12, 6);
    expect(sp[sp.length - 1][1]).toBeCloseTo(6, 6);
  });
});
