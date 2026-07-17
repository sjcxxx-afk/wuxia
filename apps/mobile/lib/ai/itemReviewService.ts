/**
 * AI 匣物评价服务
 *
 * 在入匣或改匣后，根据单件匣物信息生成 1-2 句简短评价。
 * 复用 OCR 设置中的 API 配置与 itemReviewEnabled 开关。
 */

import { getOcrSettingsAsync } from "../ocr/ocrService";
import { buildItemReviewSystemPrompt, stripMarkdown } from "./personality";
import { loadData, updateData, nowISO } from "../storage/jsonStore";
import { triggerAutoExport } from "../storage/syncService";

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
    const systemPrompt = buildItemReviewSystemPrompt(
      settings.itemReviewFollowPersonality,
      settings.personalityPreset,
      settings.personalityCustom
    );

    // DeepSeek V4 默认开启 thinking，推理与正文共用 max_tokens；
    // 原先 max_tokens=60 会被推理占满，content 为空后静默失败。
    // 短评价关闭 thinking，并给足输出额度（非 DeepSeek 会忽略 thinking 字段）。
    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `请评价以下匣物：\n${context}` },
      ],
      max_tokens: 512,
      temperature: 0.3,
    };
    if (settings.apiBase.includes("deepseek")) {
      requestBody.thinking = { type: "disabled" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const response = await fetch(`${settings.apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify(requestBody),
    });
    clearTimeout(timeout);

    if (!response.ok) return;

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content?.trim();
    if (!content) return;

    const review = stripMarkdown(content);

    updateData((data) => ({
      ...data,
      items: data.items.map((item) =>
        item.id === itemId
          ? { ...item, aiComment: review, aiCommentAt: nowISO() }
          : item
      ),
    }));
    triggerAutoExport();
  } catch {
    // 静默失败，不阻断主流程
  }
}
