/**
 * AI 匣物评价服务
 *
 * 在入匣或改匣后，根据单件匣物信息生成 1-2 句简短评价。
 * 复用 OCR 设置中的 API 配置与 itemReviewEnabled 开关。
 */

import { getOcrSettingsAsync } from "../ocr/ocrService";
import { loadData, updateData, nowISO } from "../storage/jsonStore";
import { triggerAutoExport } from "../storage/syncService";

const SYSTEM_PROMPT = `你是物匣中的 AI 助手"匣灵"。匣主会提供一件匣物的详细信息，请给出简短评价。

评价要求：
- 用中文，1-2 句话，不超过 60 字
- 从性价比、实用性、是否值得留存等维度择要点评
- 语气友好客观，像朋友给建议
- 信息不足时坦诚说明，不要编造匣物不存在的信息
- 不要加标题、引号或 markdown，直接输出评价正文`;

function buildItemContext(
  item: {
    name: string;
    categoryId: string | null;
    brand: string | null;
    purchaseDate: string | null;
    purchasePrice: number | null;
    purchasePlatform: string | null;
    storeName: string | null;
    location: string | null;
    quantity: number;
    status: string;
    notes: string | null;
    customValues: Record<string, string>;
  },
  categoryName: string | null
): string {
  return [
    `名称: ${item.name}`,
    `分类: ${categoryName ?? "未分类"}`,
    `价格: ${item.purchasePrice != null ? `¥${item.purchasePrice}` : "未知"}`,
    `状态: ${item.status}`,
    `品牌: ${item.brand ?? "未知"}`,
    `平台: ${item.purchasePlatform ?? "未知"}`,
    `备注: ${item.notes ?? "无"}`,
  ].join("\n");
}

/**
 * 为指定物品生成 AI 评价并写回存储（异步，失败静默）
 */
export async function generateAndSaveItemReview(itemId: string): Promise<void> {
  try {
    const settings = await getOcrSettingsAsync();
    if (!settings.itemReviewEnabled || !settings.apiKey.trim()) return;

    const data = await loadData();
    const raw = data.items.find((i) => i.id === itemId);
    if (!raw) return;

    const cat = data.categories.find((c) => c.id === raw.categoryId);
    const context = buildItemContext(raw, cat?.name ?? null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(`${settings.apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `请评价以下匣物：\n${context}` },
        ],
        max_tokens: 60,
        temperature: 0.3,
      }),
    });
    clearTimeout(timeout);

    if (!response.ok) return;

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content?.trim();
    if (!content) return;

    updateData((data) => ({
      ...data,
      items: data.items.map((item) =>
        item.id === itemId
          ? { ...item, aiComment: content, aiCommentAt: nowISO() }
          : item
      ),
    }));
    triggerAutoExport();
  } catch {
    // 静默失败，不阻断主流程
  }
}
