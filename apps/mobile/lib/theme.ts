/**
 * 设计令牌 —— 物匣（纸白 + 靛蓝）
 * ================================
 *
 * 风格演进记录：上一版是「木墨」（宣纸底 + 木纹 + 朱砂）。
 * 立意没错，但执行翻车 —— 宣纸底 #F2EDE4 饱和度偏高，看着**发黄、蒙灰**；
 * 木纹 / 纸纹 / 墨晕叠在界面上又碎又脏。真实设备上用户的判断是
 * 「不如原来的蓝白好看」。
 *
 * 所以这一版做了减法：
 *   1. 砍掉全部纹理（木纹 / 纸纹 / 墨晕）；
 *   2. 底色提亮到接近白的「纸白」，保留一丝暖但不再发黄；
 *   3. 主色回到鲜亮的靛蓝（历史 #4F46E5），文字改冷灰黑。
 *
 * 唯一不变、且必须继续守住的铁律：正文对比度过 WCAG AA（4.5:1），
 * 由 scripts/check-theme-contrast.js 强制执行。改色板后必须重跑 `npm run check`。
 */

/* ------------------------------------------------------------------ 色板 */

/** 原始色板 —— 只在需要从既有值推导时引用，日常代码请用下面的语义色 */
export const palette = {
  /** 纸白 —— 接近白，带一丝暖，但绝不发黄 */
  paper: "#FAF9F7",
  paperRaised: "#FFFFFF",
  paperSunken: "#F1EFEC",
  paperDeep: "#E7E5E1",

  /** 墨 —— 冷灰黑三级文字（slate 系，不再用暖褐） */
  ink: "#1F2937",
  inkSecondary: "#4B5563",
  inkTertiary: "#6B7280",

  /** 靛蓝 —— 主色。上一版朱砂太闷、没彩度，这里回到鲜亮的靛蓝 */
  indigo: "#4F46E5",
  indigoSoft: "#EEF2FF",

  /** 状态色 —— 回归干净易识别的标准色，取满足 WCAG AA 的深档 */
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  warning: "#B45309",
  warningSoft: "#FEF3C7",
  success: "#047857",
  successSoft: "#D1FAE5",

  /** 苔 —— 次级强调（保留名以免改动调用点，值即 success） */
  moss: "#047857",
  mossSoft: "#D1FAE5",

  /**
   * 图表分类色板（不是语义色）。仅作条形/饼图色块，
   * 文字一律用 colors.text，所以色块只要求视觉可区分。
   */
  chart: ["#4F46E5", "#059669", "#D97706", "#DC2626"],
} as const;

/* ------------------------------------------------------------- 语义色 */

/**
 * 语义色。刻意不给「全部色板」留出口 —— 组件只应该消费语义层，
 * 这样换风格时只需要改这一层。
 */
export const colors = {
  /** 页面底 —— 纸白 */
  background: palette.paper,
  /** 卡片 / 浮起面 —— 比底色更亮，形成「浮起一张纸」的层次 */
  surface: palette.paperRaised,
  /** 凹陷面 —— toggle 槽、分段控件底、输入框底 */
  surfaceSunken: palette.paperSunken,
  /** 更深的凹陷，用于需要与 sunken 再分一层的场合 */
  surfaceDeep: palette.paperDeep,

  /** 顶栏 */
  header: palette.paperRaised,
  headerBorder: palette.paperDeep,

  /** 文字 */
  text: palette.ink,
  textSecondary: palette.inkSecondary,
  /** 弱化文字。这档在纸白底上约 4.6:1，几乎没有余量，不要再往下调浅 */
  textTertiary: palette.inkTertiary,

  /** 描边 */
  border: palette.paperDeep,
  borderStrong: palette.paperSunken,

  /** 强调 —— 靛蓝。全局唯一品牌色 */
  accent: palette.indigo,
  accentSoft: palette.indigoSoft,
  /** 按压缩放时的水波纹色（Android）。比 accent 浅，压在白底上才不刺眼 */
  ripple: palette.indigoSoft,

  /** 次级强调 */
  moss: palette.moss,
  mossSoft: palette.mossSoft,

  /** 语义状态 */
  danger: palette.danger,
  dangerSoft: palette.dangerSoft,
  warning: palette.warning,
  warningSoft: palette.warningSoft,
  success: palette.success,
  successSoft: palette.successSoft,

  /** 图标 */
  icon: palette.inkSecondary,
  iconStrong: palette.ink,
  /** 装饰性大图标（空状态等）。0.9:1 对纸白底，仅作图形不作文字 */
  iconMuted: palette.paperDeep,

  /** 图表分类色板，见 palette.chart 的说明 */
  chart: palette.chart,
} as const;

/* ------------------------------------------------------------- 间距 */

/** 4pt 基准网格（Apple HIG 8pt 的半数粒度） */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/* ------------------------------------------------------------- 圆角 */

/** 统一圆角阶梯。不在阶梯里的值请先想清楚为什么 */
export const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
  /** 正圆（头像 / 圆形按钮） */
  round: 999,
} as const;

/* ------------------------------------------------------------- 描边 */

/**
 * Android 上 1px 与 0.5px 的观感差异极大：
 * 0.5px 在高密度屏上几乎不可见，1px 又显得笨重。统一从这里取。
 */
export const borderWidth = {
  hairline: 1,
  thin: 1,
} as const;

/* ------------------------------------------------------------- 阴影 */

/**
 * 阴影。上一版用暖褐色（压在宣纸上不显脏），现在底色是纸白、主色是冷靛蓝，
 * 暖褐阴影反而发脏，所以回到中性黑。
 */
export const shadow = {
  /** 卡片 */
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  /** 浮起菜单 / 弹层 */
  raised: {
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  none: {},
} as const;

/* ------------------------------------------------------------- 字号 */

export const type = {
  display: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  headline: { fontSize: 18, fontWeight: "700", letterSpacing: -0.2 },
  body: { fontSize: 16, fontWeight: "600", letterSpacing: -0.1 },
  bodyRegular: { fontSize: 15, fontWeight: "500" },
  label: { fontSize: 14, fontWeight: "500" },
  caption: { fontSize: 12, fontWeight: "500" },
  micro: { fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },
} as const;

/* ------------------------------------------------------------- 触控 */

/** Apple HIG 最小触控尺寸；导航栏图标可点击区不得小于此值 */
export const touchTarget = {
  min: 44,
} as const;

/* ------------------------------------------------------------- 纹理 */

/**
 * 纹理已整体移除。
 *
 * 上一版这里放着木纹 / 纸纹 / 墨晕的不透明度上限与平铺尺寸（配套组件在
 * components/Texture/，另有 scripts/generate-textures.js 生成可平铺 PNG）。
 * 真实设备上的结论是：这些纹理**又碎又脏**，把界面弄浑了，
 * 而它们的「附加值」远不及代价 —— 于是连同那两个组件与脚本一并删除。
 *
 * 保留这个空对象是为了让历史调用点（若有遗漏）不会因为 import 失败而崩，
 * 但它不该再被新增使用。要加质感，优先用间距、字重、层级，而不是贴图。
 */
export const texture = {} as const;

/* ------------------------------------------------------------- 动效 */

/**
 * 动效参数沿用 Material Motion 的时长阶梯，
 * 配合 Reanimated 的 spring 曲线实现。
 */
export const motion = {
  /** 微交互：按压、状态切换 */
  durationFast: 120,
  /** 组件内转场 */
  durationBase: 220,
  /** 页面级转场 */
  durationSlow: 320,
  /** 启动页 */
  durationSplash: 900,

  /** 按压缩放 —— 0.94 而非 0.9，压得太狠会显得廉价 */
  pressScale: 0.94,
  /** 图标选中态回弹 */
  iconPopScale: 1.12,

  /** 弹簧：选中/回弹用 */
  spring: { damping: 14, stiffness: 220, mass: 0.6 },
  /** 弹簧：更轻的弹跳，用于图标 */
  springBouncy: { damping: 10, stiffness: 260, mass: 0.5 },
} as const;

export const theme = {
  palette,
  colors,
  spacing,
  radius,
  borderWidth,
  shadow,
  type,
  touchTarget,
  motion,
} as const;

export type ThemeColors = typeof colors;
export type SpacingKey = keyof typeof spacing;
export type RadiusKey = keyof typeof radius;

export default theme;
