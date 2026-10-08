#!/usr/bin/env node
/**
 * 配色对比度守卫
 * ==============
 *
 * 为什么需要它：无论风格怎么换，「底色 + 弱化文字」这一类的组合都很容易
 * 滑到 3:1 上下 —— 那是大字号图形才够的门槛，正文和小标签直接看不清。
 * 注释里写「注意压深过」是拦不住后续改动的，所以把 AA 变成可执行断言。
 *
 * 注意：断言引用的是 **palette 的键名**。换配色时键名若变，这里的 PAIRS
 * 会直接抛「断言引用了不存在的色板键」，而不是静默跳过 —— 这是刻意的。
 *
 * 它真的去读 lib/theme.ts 里 palette 的十六进制值，而不是复制一份到脚本里：
 * 改了 theme 这里的断言会跟着变，不会出现「脚本里的颜色早就过期了」。
 *
 * CLI 用法：node scripts/check-theme-contrast.js
 *   退出码 0 = 全部达标；1 = 有组合不达标（打印实测值与差距）
 */

const fs = require("fs");
const path = require("path");

/* ------------------------------------------------------------ 颜色数学 */

/** "#RRGGBB" → [r, g, b]（0-255）；无法解析时抛错而不是静默当黑色 */
function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) throw new Error(`不是合法的 #RRGGBB 颜色：${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** sRGB 单通道 → 线性空间 */
function channelToLinear(c8) {
  const c = c8 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.1 相对亮度 */
function relativeLuminance(hex) {
  const [r, g, b] = parseHex(hex).map(channelToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 对比度，返回形如 12.7 */
function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/* -------------------------------------------------------- 读取 theme 源 */

/**
 * 从 lib/theme.ts 里抠出 `export const palette = { ... } as const` 的键值对。
 * 刻意不引 ts-node / TS 编译器：这个脚本要在 CI 与提交前钩子里毫秒级跑完，
 * 不能因为类型工具链变动而失败。
 */
function readPalette(themePath) {
  const src = fs.readFileSync(themePath, "utf8");
  const block = /export const palette = \{([\s\S]*?)\n\} as const;/.exec(src);
  if (!block) throw new Error(`在 ${themePath} 里找不到 "export const palette = { ... } as const"`);

  const palette = {};
  for (const line of block[1].split("\n")) {
    const kv = /^\s*([A-Za-z0-9_]+):\s*"(#[0-9a-fA-F]{6})",?\s*$/.exec(line);
    if (kv) palette[kv[1]] = kv[2];
  }
  if (Object.keys(palette).length === 0) {
    throw new Error(`从 ${themePath} 的 palette 里解析出 0 个颜色，是格式变了吗？`);
  }
  return palette;
}

/* ---------------------------------------------------------- WCAG 门槛 */

const AA_TEXT = 4.5;
/** ≥18pt / ≥14pt 粗体，或纯图形（非文字元素）的对比度门槛 */
const AA_LARGE_TEXT = 3.0;

/**
 * 需要守住的前景/背景组合。
 *   label —— 报告里怎么称呼它
 *   min   —— 最低对比度
 *   why   —— 不达标的后果，写清楚才有人在乎
 */
const PAIRS = [
  { label: "正文 / 纸白底", fg: "ink", bg: "paper", min: AA_TEXT, why: "列表项名称全部不可读" },
  { label: "正文 / 卡片面", fg: "ink", bg: "paperRaised", min: AA_TEXT, why: "卡片标题不可读" },
  { label: "次级文字 / 纸白底", fg: "inkSecondary", bg: "paper", min: AA_TEXT, why: "品牌名、日期等失效" },
  { label: "次级文字 / 卡片面", fg: "inkSecondary", bg: "paperRaised", min: AA_TEXT, why: "卡片副标题失效" },
  {
    label: "弱化文字 / 纸白底",
    fg: "inkTertiary",
    bg: "paper",
    min: AA_TEXT,
    why: "12px 以下计数与提示看不清（这组几乎没有余量，不要再调浅）",
  },
  {
    label: "弱化文字 / 卡片面",
    fg: "inkTertiary",
    bg: "paperRaised",
    min: AA_TEXT,
    why: "卡片内小字失效",
  },
  { label: "靛蓝强调 / 纸白底", fg: "indigo", bg: "paper", min: AA_TEXT, why: "选中态标签与链接不可读" },
  { label: "靛蓝强调 / 卡片面", fg: "indigo", bg: "paperRaised", min: AA_TEXT, why: "卡片内强调失效" },
  { label: "成功绿 / 纸白底", fg: "success", bg: "paper", min: AA_TEXT, why: "成功态文字不可读" },
  { label: "危险红 / 纸白底", fg: "danger", bg: "paper", min: AA_TEXT, why: "删除确认文字不可读" },
  { label: "警示橙 / 纸白底", fg: "warning", bg: "paper", min: AA_TEXT, why: "提醒横幅文字不可读" },

  // 底部导航栏底色是纯白（surface），这几组直接决定导航能不能用
  { label: "导航标签（选中）", fg: "indigo", bg: "paperRaised", min: AA_TEXT, why: "选中标签不可读" },
  { label: "导航标签（未选）", fg: "inkSecondary", bg: "paperRaised", min: AA_TEXT, why: "未选标签不可读" },
];

/**
 * 反向登记：某些组合是**故意**不达标的（拿来做分隔线、装饰图形），
 * 记在这里是为了让「它为什么不能用」有据可查，避免后人误用成前景色。
 */
const INTENTIONAL_FAILURES = [
  {
    label: "分割线 / 纸白底",
    fg: "paperDeep",
    bg: "paper",
    why: "仅作分隔线与描边，不可用于任何文字",
  },
  {
    label: "凹陷面 / 纸白底",
    fg: "paperSunken",
    bg: "paper",
    why: "仅作 toggle 槽、输入框底等容器面，不可作前景",
  },
];

/* -------------------------------------------------------------- 主流程 */

/** 跑一组断言，返回带实测比值的结果 */
function evaluate(pairs, palette) {
  return pairs.map((p) => {
    const fg = palette[p.fg];
    const bg = palette[p.bg];
    if (!fg || !bg) throw new Error(`断言引用了不存在的色板键：${p.fg} / ${p.bg}`);
    const ratio = contrastRatio(fg, bg);
    return { ...p, fgHex: fg, bgHex: bg, ratio, pass: ratio >= p.min };
  });
}

/** 从真实仓库读取 palette */
function readEnvironment(projectRoot) {
  return readPalette(path.join(projectRoot, "lib", "theme.ts"));
}

function main() {
  const projectRoot = path.resolve(__dirname, "..");
  let palette;
  try {
    palette = readEnvironment(projectRoot);
  } catch (err) {
    console.error(`[theme-contrast] 读取 lib/theme.ts 失败：${err.message}`);
    return 1;
  }

  let results;
  try {
    results = evaluate(PAIRS, palette);
  } catch (err) {
    console.error(`[theme-contrast] ${err.message}`);
    return 1;
  }
  const failures = results.filter((r) => !r.pass);

  console.log("[theme-contrast] 配色对比度实测（WCAG 2.1）");
  for (const r of results) {
    console.log(
      `  ${r.pass ? "✓" : "✗"} ${r.label.padEnd(26)} ${r.ratio.toFixed(2).padStart(6)}:1` +
        `  (需 ≥${r.min})  ${r.fgHex} on ${r.bgHex}`,
    );
  }
  for (const f of INTENTIONAL_FAILURES) {
    const fg = palette[f.fg];
    const bg = palette[f.bg];
    if (!fg || !bg) continue;
    console.log(
      `  · ${f.label.padEnd(26)} ${contrastRatio(fg, bg).toFixed(2).padStart(6)}:1` +
        `  故意不达标 —— ${f.why}`,
    );
  }

  if (failures.length > 0) {
    console.error("\n[theme-contrast] 以下组合未达 WCAG AA：");
    for (const f of failures) {
      console.error(
        `  ✗ ${f.label}：实测 ${f.ratio.toFixed(2)}:1，需 ≥${f.min} —— ${f.why}`,
      );
    }
    console.error("\n  修法：压深前景色或提亮底色，别靠加粗凑。改完直接重跑本脚本。");
    return 1;
  }
  console.log("[theme-contrast] 通过：所有正文组合达 WCAG AA。");
  return 0;
}

module.exports = {
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
};

if (require.main === module) {
  process.exit(main());
}
