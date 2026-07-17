/**
 * 匣中数据本地预计算 —— 为匣灵问答提供确定性事实层
 */

import type { CategoryData, ItemData, WarehouseData } from "../storage/jsonStore";

export interface WarehouseInsights {
  最贵匣物: Array<{ 名称: string; 分类: string; 价格: number; 平台: string }>;
  最近购买: Array<{ 名称: string; 分类: string; 价格: number; 购买日期: string }>;
  平台花费: Array<{ 平台: string; 总金额: number; 件数: number }>;
  闲置匣物: Array<{ 名称: string; 分类: string; 价格: number }>;
  分类统计: Array<{ 名称: string; 件数: number; 总金额: number }>;
}

const TOP_N = 5;

function categoryName(categories: CategoryData[], categoryId: string | null): string {
  if (!categoryId) return "未分类";
  return categories.find((c) => c.id === categoryId)?.name ?? "未分类";
}

function normalizePlatform(platform: string | null): string {
  const p = platform?.trim();
  return p || "未知";
}

function itemPrice(item: ItemData): number {
  return item.purchasePrice ?? 0;
}

function mapItemBase(item: ItemData, categories: CategoryData[]) {
  return {
    名称: item.name,
    分类: categoryName(categories, item.categoryId),
    价格: itemPrice(item),
  };
}

export function buildInsights(data: WarehouseData): WarehouseInsights {
  const { items, categories } = data;

  const sortedByPrice = [...items].sort((a, b) => itemPrice(b) - itemPrice(a));
  const 最贵匣物 = sortedByPrice.slice(0, TOP_N).map((item) => ({
    ...mapItemBase(item, categories),
    平台: normalizePlatform(item.purchasePlatform),
  }));

  const sortedByDate = [...items].sort((a, b) => {
    const da = a.purchaseDate ?? "";
    const db = b.purchaseDate ?? "";
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db.localeCompare(da);
  });
  const 最近购买 = sortedByDate.slice(0, TOP_N).map((item) => ({
    ...mapItemBase(item, categories),
    购买日期: item.purchaseDate ?? "",
  }));

  const platformMap = new Map<string, { 总金额: number; 件数: number }>();
  for (const item of items) {
    const platform = normalizePlatform(item.purchasePlatform);
    const entry = platformMap.get(platform) ?? { 总金额: 0, 件数: 0 };
    entry.总金额 += itemPrice(item);
    entry.件数 += 1;
    platformMap.set(platform, entry);
  }
  const 平台花费 = [...platformMap.entries()]
    .map(([平台, { 总金额, 件数 }]) => ({ 平台, 总金额, 件数 }))
    .sort((a, b) => b.总金额 - a.总金额);

  const 闲置匣物 = items
    .filter((item) => item.status === "闲置中")
    .map((item) => mapItemBase(item, categories));

  const 分类统计 = categories
    .map((cat) => {
      const catItems = items.filter((i) => i.categoryId === cat.id);
      return {
        名称: cat.name,
        件数: catItems.length,
        总金额: catItems.reduce((sum, i) => sum + itemPrice(i), 0),
      };
    })
    .filter((c) => c.件数 > 0)
    .sort((a, b) => b.件数 - a.件数);

  return { 最贵匣物, 最近购买, 平台花费, 闲置匣物, 分类统计 };
}

export function buildInsightsJson(data: WarehouseData): string {
  return JSON.stringify(buildInsights(data), null, 2);
}
