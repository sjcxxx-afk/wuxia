/**
 * Verify warehouseInsights local precompute logic.
 * Run: node apps/mobile/scripts/verify-warehouse-insights.mjs
 */

const mockData = {
  categories: [
    { id: "c1", name: "数码", icon: "📱", color: null, parentId: null, sortOrder: 0, customFields: [], createdAt: "", updatedAt: "" },
    { id: "c2", name: "家居", icon: "🏠", color: null, parentId: null, sortOrder: 1, customFields: [], createdAt: "", updatedAt: "" },
  ],
  items: [
    { id: "1", name: "耳机", categoryId: "c1", brand: "Sony", purchaseDate: "2026-01-15", purchasePrice: 1299, purchasePlatform: "京东", storeName: "", location: "", quantity: 1, status: "使用中", notes: "", images: [], customValues: {}, aiComment: null, aiCommentAt: null, createdAt: "", updatedAt: "" },
    { id: "2", name: "键盘", categoryId: "c1", brand: "Keychron", purchaseDate: "2026-03-20", purchasePrice: 599, purchasePlatform: "淘宝", storeName: "", location: "", quantity: 1, status: "闲置中", notes: "", images: [], customValues: {}, aiComment: null, aiCommentAt: null, createdAt: "", updatedAt: "" },
    { id: "3", name: "台灯", categoryId: "c2", brand: null, purchaseDate: "2025-12-01", purchasePrice: 199, purchasePlatform: "京东", storeName: "", location: "", quantity: 1, status: "使用中", notes: "", images: [], customValues: {}, aiComment: null, aiCommentAt: null, createdAt: "", updatedAt: "" },
    { id: "4", name: "显示器", categoryId: "c1", brand: "Dell", purchaseDate: null, purchasePrice: 2499, purchasePlatform: "京东", storeName: "", location: "", quantity: 1, status: "使用中", notes: "", images: [], customValues: {}, aiComment: null, aiCommentAt: null, createdAt: "", updatedAt: "" },
  ],
};

function categoryName(categories, categoryId) {
  if (!categoryId) return "未分类";
  return categories.find((c) => c.id === categoryId)?.name ?? "未分类";
}

function normalizePlatform(platform) {
  const p = platform?.trim();
  return p || "未知";
}

function itemPrice(item) {
  return item.purchasePrice ?? 0;
}

function buildInsights(data) {
  const { items, categories } = data;
  const TOP_N = 5;

  const sortedByPrice = [...items].sort((a, b) => itemPrice(b) - itemPrice(a));
  const topExpensive = sortedByPrice.slice(0, TOP_N).map((item) => ({
    名称: item.name,
    分类: categoryName(categories, item.categoryId),
    价格: itemPrice(item),
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
  const recent = sortedByDate.slice(0, TOP_N).map((item) => ({
    名称: item.name,
    分类: categoryName(categories, item.categoryId),
    价格: itemPrice(item),
    购买日期: item.purchaseDate ?? "",
  }));

  const platformMap = new Map();
  for (const item of items) {
    const platform = normalizePlatform(item.purchasePlatform);
    const entry = platformMap.get(platform) ?? { 总金额: 0, 件数: 0 };
    entry.总金额 += itemPrice(item);
    entry.件数 += 1;
    platformMap.set(platform, entry);
  }
  const platformSpending = [...platformMap.entries()]
    .map(([平台, { 总金额, 件数 }]) => ({ 平台, 总金额, 件数 }))
    .sort((a, b) => b.总金额 - a.总金额);

  const idle = items
    .filter((item) => item.status === "闲置中")
    .map((item) => ({
      名称: item.name,
      分类: categoryName(categories, item.categoryId),
      价格: itemPrice(item),
    }));

  return { 最贵匣物: topExpensive, 最近购买: recent, 平台花费: platformSpending, 闲置匣物: idle };
}

const insights = buildInsights(mockData);

console.log("=== warehouseInsights verify ===\n");
console.log(JSON.stringify(insights, null, 2));

const checks = [
  ["最贵首项", insights.最贵匣物[0]?.名称 === "显示器"],
  ["最近首项", insights.最近购买[0]?.名称 === "键盘"],
  ["无日期排后", insights.最近购买[insights.最近购买.length - 1]?.名称 === "显示器"],
  ["京东花费最多", insights.平台花费[0]?.平台 === "京东"],
  ["闲置仅键盘", insights.闲置匣物.length === 1 && insights.闲置匣物[0]?.名称 === "键盘"],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failed += 1;
}

if (failed > 0) {
  process.exit(1);
}
console.log("\nAll checks passed.");
