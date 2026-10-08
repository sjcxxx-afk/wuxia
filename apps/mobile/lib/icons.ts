/**
 * 图标索引 —— 物匣
 * ================
 *
 * 语义名 → Ionicons 字形名。
 *
 * 为什么保留这一层：调用方写 `<Icon name="chest" />` 而不是
 * `<Ionicons name="file-tray-full-outline" />`。语义名跟着**业务概念**走
 * （匣中 / 分类 / 匣主 / 匣灵），字形跟着**图标库**走。将来换图标库只改这个文件。
 *
 * 为什么不再手写 SVG：上一版为了「笔触感」手绘了 24×24 的路径。结论是
 * 手绘 SVG 在造型统一性、光学修正、视觉重心这些地方明显不如专业图标库 ——
 * 放大镜被两段大弧拼成了尖椭圆，分类（原博古架）在 25px 下糊成一团。
 * 用户的判断直接了当：「原来的图标会更有设计感」。所以回到 Ionicons。
 *
 * 选中态用 Ionicons 天然的 outline / filled 一对：
 * 比「叠加笔画 + 描边加粗」更干净，也是 Ionicons 自己的惯例。
 */

import { Ionicons } from "@expo/vector-icons";

type IoniconName = keyof typeof Ionicons.glyphMap;

export type IconName =
  /* 导航 */
  | "chest" // 匣中 —— 列表
  | "shelf" // 分类
  | "search" // 搜索
  | "seal" // 匣主 —— 设置/资料
  /* 核心动作 */
  | "plus" // 新增
  | "inkDrop" // 匣灵 —— AI 助手
  | "ocr" // 截图识别
  | "file" // 文件导入
  /* 等级（匣主成长） */
  | "level1"
  | "level2"
  | "level3"
  | "level4"
  | "level5"
  | "level6";

export type IconDef = {
  /** 默认态（线性） */
  outline: IoniconName;
  /** 选中态（实心）。与 outline 相同表示该图标没有实心变体 */
  filled: IoniconName;
};

export const ICONS: Record<IconName, IconDef> = {
  chest: { outline: "file-tray-full-outline", filled: "file-tray-full" },
  shelf: { outline: "grid-outline", filled: "grid" },
  search: { outline: "search-outline", filled: "search" },
  seal: { outline: "diamond-outline", filled: "diamond" },

  plus: { outline: "add-circle", filled: "add-circle" },
  inkDrop: { outline: "sparkles", filled: "sparkles" },
  ocr: { outline: "scan-outline", filled: "scan" },
  file: { outline: "document-text-outline", filled: "document-text" },

  // 等级：从「一个空匣」递进到「满匣生光」
  level1: { outline: "cube-outline", filled: "cube" },
  level2: { outline: "file-tray-outline", filled: "file-tray" },
  level3: { outline: "file-tray-full-outline", filled: "file-tray-full" },
  level4: { outline: "albums-outline", filled: "albums" },
  level5: { outline: "diamond-outline", filled: "diamond" },
  level6: { outline: "sparkles", filled: "sparkles" },
};

/** 等级序号 → 图标名，供 ProfileHeader 等处使用 */
export const LEVEL_ICON_NAMES = [1, 2, 3, 4, 5, 6].map(
  (n) => `level${n}` as IconName,
);

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/**
 * 四个导航 Tab 的图标。
 * 单独导出，好让 (tabs)/_layout.tsx 不必知道别的图标存在。
 */
export const TAB_ICONS = {
  items: "chest",
  categories: "shelf",
  search: "search",
  profile: "seal",
} as const satisfies Record<string, IconName>;

export default ICONS;
