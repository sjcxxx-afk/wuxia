const {
  parseHex,
  channelToLinear,
  relativeLuminance,
  contrastRatio,
  readPalette,
  evaluate,
  readEnvironment,
  AA_TEXT,
  AA_LARGE_TEXT,
  PAIRS,
  INTENTIONAL_FAILURES,
} = require("../check-theme-contrast");

describe("颜色数学", () => {
  it("parseHex 正确拆出通道", () => {
    expect(parseHex("#FFFFFF")).toEqual([255, 255, 255]);
    expect(parseHex("#2B2723")).toEqual([43, 39, 35]);
    expect(parseHex("2B2723")).toEqual([43, 39, 35]); // 容许省略 #
  });

  it("parseHex 对非法值抛错而不是静默当黑色", () => {
    expect(() => parseHex("#FFF")).toThrow();
    expect(() => parseHex("rgb(1,2,3)")).toThrow();
  });

  it("黑白对比度等于 21", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 2);
  });

  it("同色对比度为 1", () => {
    expect(contrastRatio("#4F46E5", "#4F46E5")).toBeCloseTo(1, 5);
  });

  it("对比度与前景背景顺序无关", () => {
    const a = contrastRatio("#2B2723", "#F2EDE4");
    const b = contrastRatio("#F2EDE4", "#2B2723");
    expect(a).toBeCloseTo(b, 10);
  });

  it("channelToLinear 端点与线性段都正确", () => {
    expect(channelToLinear(0)).toBeCloseTo(0, 6);
    expect(channelToLinear(255)).toBeCloseTo(1, 6);
    expect(channelToLinear(10)).toBeCloseTo(10 / 255 / 12.92, 6);
  });

  it("relativeLuminance 相对亮度落在 0-1", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 6);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 6);
  });
});

describe("readPalette", () => {
  it("从真实的 lib/theme.ts 里抠出全部色板键", () => {
    const palette = readPalette(
      require("path").resolve(__dirname, "..", "..", "lib", "theme.ts"),
    );
    // 纸白 + 靛蓝体系的必需色板，缺一个都会让组件无从取色。
    // 换配色时这里的键名要一起改 —— 改不动就说明有组件还在依赖旧键。
    [
      "paper",
      "paperRaised",
      "paperSunken",
      "paperDeep",
      "ink",
      "inkSecondary",
      "inkTertiary",
      "indigo",
      "indigoSoft",
      "success",
      "danger",
      "warning",
    ].forEach((k) => {
      expect(palette[k]).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it("旧「木墨」色板键已彻底移除", () => {
    const palette = readPalette(
      require("path").resolve(__dirname, "..", "..", "lib", "theme.ts"),
    );
    // 木纹/纸纹已砍掉，这些键若还在说明有人把旧体系带回来了
    ["woodLight", "wood", "woodDark", "woodInk", "cinnabar", "cinnabarDeep"].forEach((k) => {
      expect(palette[k]).toBeUndefined();
    });
  });

  it("解析出 0 个颜色时抛错（格式变了要立刻暴露）", () => {
    expect(() => readPalette("/dev/null")).toThrow();
  });
});

describe("配色达标情况（当前仓库真实状态）", () => {
  const projectRoot = require("path").resolve(__dirname, "..", "..");

  it("所有正文 / 图文组合达 WCAG AA", () => {
    const results = evaluate(PAIRS, readEnvironment(projectRoot));
    const failures = results
      .filter((r) => !r.pass)
      .map((r) => `${r.label} 实测 ${r.ratio.toFixed(2)}:1 < ${r.min}`);
    expect(failures).toEqual([]);
  });

  it("品牌主色靛蓝在两种面上都达 AA —— 它是选中态与主操作的颜色", () => {
    const env = readEnvironment(projectRoot);
    expect(contrastRatio(env.indigo, env.paper)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(env.indigo, env.paperRaised)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("底部导航栏底色是纯白，标签两态都必须达 AA", () => {
    const env = readEnvironment(projectRoot);
    // 导航栏背景取 surface（= paperRaised）
    expect(contrastRatio(env.indigo, env.paperRaised)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(env.inkSecondary, env.paperRaised)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("弱化文字 inkTertiary 仍然达标（余量很小，调色要重新验）", () => {
    const env = readEnvironment(projectRoot);
    const r = contrastRatio(env.inkTertiary, env.paper);
    expect(r).toBeGreaterThanOrEqual(AA_TEXT);
    // 同时钉住上界：这一组没有富余，一旦调浅就会跌破 AA
    expect(r).toBeLessThan(5.5);
  });

  it("三个状态色在纸白底上都达 AA —— 它们会被当文字用", () => {
    const env = readEnvironment(projectRoot);
    for (const key of ["success", "danger", "warning"]) {
      expect(contrastRatio(env[key], env.paper)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it("故意不达标的组合确实达不到文字门槛（它们只配做分隔线 / 容器面）", () => {
    const env = readEnvironment(projectRoot);
    for (const f of INTENTIONAL_FAILURES) {
      const ratio = contrastRatio(env[f.fg], env[f.bg]);
      expect(ratio).toBeLessThan(AA_TEXT);
      expect(f.why).toMatch(/不可|必须/);
    }
  });

  it("未选中的导航图标至少过非文字门槛 3:1", () => {
    const env = readEnvironment(projectRoot);
    expect(contrastRatio(env.inkSecondary, env.paperRaised)).toBeGreaterThanOrEqual(
      AA_LARGE_TEXT,
    );
  });
});

describe("evaluate", () => {
  it("引用不存在的色板键时抛错", () => {
    expect(() =>
      evaluate([{ label: "x", fg: "notAColor", bg: "paper", min: 4.5 }], { paper: "#FFFFFF" }),
    ).toThrow(/不存在的色板键/);
  });

  it("min 设得不可能时判为不通过", () => {
    const [r] = evaluate([{ label: "x", fg: "a", bg: "b", min: 99 }], {
      a: "#000000",
      b: "#FFFFFF",
    });
    expect(r.pass).toBe(false);
    expect(r.ratio).toBeCloseTo(21, 2);
  });

  it("达标时 pass 为 true", () => {
    const [r] = evaluate([{ label: "x", fg: "a", bg: "b", min: 4.5 }], {
      a: "#000000",
      b: "#FFFFFF",
    });
    expect(r.pass).toBe(true);
  });
});
