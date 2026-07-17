/**
 * AI 智能问答服务
 *
 * 将匣主物匣数据作为上下文，调用 LLM 进行自然语言查询。
 * 复用 OCR 设置中的 AI 配置（供应商、API Key、Base、模型）。
 */

import { buildQaSystemPrompt, stripMarkdown } from "./personality";
import { buildInsightsJson } from "./warehouseInsights";
import { getOcrSettingsAsync } from "../ocr/ocrService";
import { loadData } from "../storage/jsonStore";

export interface QaMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * 构建物品数据的精简上下文
 */
async function buildContext(): Promise<string> {
  const data = await loadData();

  const items = data.items.map((item) => {
    const cat = data.categories.find((c) => c.id === item.categoryId);
    return {
      名称: item.name,
      分类: cat?.name ?? "未分类",
      品牌: item.brand ?? "",
      价格: item.purchasePrice ?? 0,
      平台: item.purchasePlatform ?? "",
      店铺: item.storeName ?? "",
      位置: item.location ?? "",
      数量: item.quantity ?? 1,
      状态: item.status ?? "使用中",
      备注: item.notes ?? "",
      购买日期: item.purchaseDate ?? "",
    };
  });

  const stats = {
    匣中件数: data.items.length,
    闲置中: data.items.filter((i) => i.status === "闲置中").length,
    使用中: data.items.filter((i) => i.status === "使用中").length,
    总价值: data.items.reduce((sum, i) => sum + (i.purchasePrice ?? 0), 0),
    分类列表: data.categories.map((c) => ({
      名称: c.name,
      图标: c.icon ?? "📦",
      匣物数: data.items.filter((i) => i.categoryId === c.id).length,
    })),
  };

  return JSON.stringify({ 统计: stats, 匣中列表: items }, null, 2);
}

/**
 * 向 AI 发送问答请求
 */
export async function askQuestion(
  question: string,
  history: QaMessage[]
): Promise<string> {
  const settings = await getOcrSettingsAsync();

  if (!settings.apiKey) {
    throw new Error("请先在设置中配置 AI 接口");
  }

  const data = await loadData();
  const context = await buildContext();
  const insights = buildInsightsJson(data);
  const systemPrompt = buildQaSystemPrompt(
    settings.personalityPreset,
    settings.personalityCustom
  );

  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
    {
      role: "system",
      content: `当前匣主的匣中数据如下（JSON 格式）：\n\`\`\`json\n${context}\n\`\`\``,
    },
    {
      role: "system",
      content: `以下是由匣中数据本地预计算的准确结果，回答排名/统计/平台花费等问题时必须优先引用，不得与其中数字矛盾：\n\`\`\`json\n${insights}\n\`\`\``,
    },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  const response = await fetch(`${settings.apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      max_tokens: 1500,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI 请求失败 (${response.status}): ${err.slice(0, 200)}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "抱歉，未能获取回答。";
  return stripMarkdown(content.trim());
}
