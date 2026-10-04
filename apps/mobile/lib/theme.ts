/**
 * 木墨设计令牌 —— 物匣
 * ============================
 *
 * 设计立意：产品叫「物匣」，匣就是木头做的。所以木纹不是贴上去的装饰，
 * 而是产品本体的隐喻；中式绘画里专门描绘器物收藏的「博古图」正是水墨，
 * 与「记录、整理、寻觅匣中之物」天然同源。
 *
 * 两条不可让步的铁律（防止风格滑向「茶室风」）：
 *   1. 木纹不透明度 ≤ 10%，纸纹 ≤ 6%；
 *   2. 48px 以下的小控件（chip / badge / 小按钮）内部禁止放任何纹理，会糊成噪点。
 * 文字一律压在实底上，正文对比度必须过 WCAG AA（4.5:1）。
 * 违反这两条的字段请勿新增。
 *
 * 冷调靛蓝（历史遗留的 #4F46E5）已整体废弃 —— 冷紫 × 暖木纹必然发脏。
 * 全局唯一高彩度色是朱砂，对应水墨里的「印」，只用于选中态 / 主操作 / 角标。
 */

/* ------------------------------------------------------------------ 色板 */

/** 原始色板 —— 只在需要从既有值推导时引用，日常代码请用下面的语义色 */
export const palette = {
  /** 纸 —— 宣纸底色 */
  paper: "#F2EDE4",
  paperRaised: "#FAF7F1",
  paperSunken: "#E8E1D4",
  paperDeep: "#DED5C4",

  /** 木 —— 木纹与器物感，线性、温暖、有方向 */
  woodLight: "#D9C3A5",
  wood: "#B8946A",
  woodDark: "#8A6A47",
  woodInk: "#6B5033",

  /** 墨 —— 焦墨 / 淡墨 / 清墨三级文字 */
  ink: "#2B2723",
  inkSecondary: "#5A534B",
  inkTertiary: "#6F675C",

  /** 朱砂 —— 钤印。全局唯一高彩度色，用量必须极小 */
  cinnabar: "#B03A2E",
  /** 深朱砂 —— 供木色底面使用（浅木底上普通朱砂仅 3.5:1，不够） */
  cinnabarDeep: "#8E2B21",
  /** 淡朱砂 —— 填充底 */
  cinnabarSoft: "#F3E3E0",

  /** 苔 —— 次级强调，替代历史遗留的 success 绿 */
  moss: "#5F6B4E",
  mossSoft: "#EAEDE6",
  /** 黛 —— 图表用的冷调，与前三档拉开色相 */
  slate: "#4A6076",

  /**
   * 图表分类色板（不是语义色）。
   * 四档全部 ≥4.5:1（实测 4.87 / 5.05 / 7.15 / 5.58），
   * 因此既能当色块，也能直接当文字色用。
   * 顺序已按「相邻两档色相尽量远」排过，别随意重排。
   */
  chart: ["#5F6B4E", "#8A5A1F", "#8E2B21", "#4A6076"],

  /** 状态色。刻意避开正红正绿：红绿在宣纸底上太扎眼且多为纯色块，
   *  这里都压成偏赭、偏苔的调子，与木墨同源。 */
  danger: "#A5342A",
  dangerSoft: "#F6E5E2",
  warning: "#8A5A1F",
  warningSoft: "#F7EBD8",
} as const;

/* ------------------------------------------------------------- 语义色 */

/**
 * 语义色。刻意不给「全部色板」留出口 —— 组件只应该消费语义层，
 * 这样换风格时只需要改这一层。
 */
export const colors = {
  /** 页面底 —— 宣纸 */
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

  /** 底部导航栏 —— 浅木条（比深木安全：深木底上浅墨文字难以过 AA） */
  tabBar: palette.woodLight,
  /** 木纹线条，压在 tabBar 上 */
  tabBarGrain: palette.wood,
  tabBarBorder: palette.wood,

  /** 文字 */
  text: palette.ink,
  textSecondary: palette.inkSecondary,
  /** 文字。注意：清墨在宣纸底上仅 4.78:1，已压深过；不要再往下调浅 */
  textTertiary: palette.inkTertiary,
  // 刻意不提供 textOnWood：浅木底（woodLight）上放宣纸色文字只有 1.6:1，
  // 远不达标。木面上的文字一律用 colors.text（焦墨），实测 8.68:1。

  /** 描边 */
  border: palette.paperDeep,
  borderStrong: palette.paperSunken,
  /** 描边压在木面上 */
  borderOnWood: palette.wood,
  /** 木面上的水波纹 / 按压反馈色。比 wood 更深，压在浅木底上才看得见 */
  woodInk: palette.woodInk,

  /** 强调 —— 纸面上用 cinnabar，木面上用 cinnabarDeep */
  accent: palette.cinnabar,
  accentOnWood: palette.cinnabarDeep,
  accentSoft: palette.cinnabarSoft,

  /** 次级强调 */
  moss: palette.moss,
  mossSoft: palette.mossSoft,

  /** 语义状态 */
  danger: palette.danger,
  dangerSoft: palette.dangerSoft,
  warning: palette.warning,
  warningSoft: palette.warningSoft,
  success: palette.moss,
  successSoft: palette.mossSoft,

  /** 图标 */
  icon: palette.inkSecondary,
  iconStrong: palette.ink,
  iconMuted: palette.paperDeep,
  /** 木面上的图标：不能用 woodDark —— 它在 woodLight 上只有 2.9:1，不过非文字 3:1 门槛 */
  iconOnWood: palette.inkSecondary,

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
 * 阴影用暖褐色而不是黑色 —— 黑阴影压在宣纸上会显脏，
 * 这也是纸感的关键细节。
 */
export const shadow = {
  /** 卡片 */
  card: {
    shadowColor: "#4A3B28",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  /** 浮起菜单 / 弹层 */
  raised: {
    shadowColor: "#3A2E1E",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  /** 木条上的内阴影感靠渐变，不靠 shadow */
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
 * 纹理层不透明度上限。`WoodGrain` / `PaperGrain` / `InkBloom` 组件
 * 会读这里的值作为硬上限，越过即视为违反铁律。
 */
export const texture = {
  /** 木纹不透明度上限 —— 超过就开始「茶室风」 */
  woodMaxOpacity: 0.1,
  /** 纸纹不透明度上限 */
  paperMaxOpacity: 0.06,
  /** 墨晕不透明度上限（仅启动页用） */
  inkMaxOpacity: 0.18,
  /** 小于此尺寸的控件不允许承载纹理 */
  minSizeForTexture: 48,
} as const;

/** 纹理的平铺尺寸（px）。木纹必须是可无缝平铺的小图，
 *  绝不能用 resizeMode="stretch" 拉到全屏 —— 木纹有方向，拉伸即失真模糊。 */
export const textureTile = {
  wood: 200,
  paper: 180,
} as const;

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
  texture,
  textureTile,
  motion,
} as const;

export type ThemeColors = typeof colors;
export type SpacingKey = keyof typeof spacing;
export type RadiusKey = keyof typeof radius;

export default theme;
