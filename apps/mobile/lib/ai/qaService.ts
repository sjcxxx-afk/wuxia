/**
 * AI 智能问答服务
 *
 * 将用户仓库数据作为上下文，调用 LLM 进行自然语言查询。
 * 复用 OCR 设置中的 AI 配置（供应商、API Key、Base、模型）。
 */

import { getOcrSettingsAsync } from "../ocr/ocrService";
import { loadData } from "../storage/jsonStore";

export interface QaMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `你是一个个人仓库管理助手。用户会向你询问关于ta物品仓库中的各种问题。

我会把用户的物品数据以 JSON 格式提供给你。请根据这些数据回答问题。

回答规则：
- 用中文回答，语气友好简洁
- 如果数据不足以回答问题，坦诚告知
- 涉及到金额时，加上 ¥ 符号
- 列举物品时，每行一个，格式为"物品名 - 分类 - 价格"
- 如果用户问"最贵""最多"等排名类问题，列出 Top 5
- 用户问总数/总价值时，直接给出数字

你可以回答的问题类型：
- 统计类：总数、总价值、闲置数量、各分类数量
- 查询类：某个物品在哪里、某个品牌有哪些、某平台买了什么
- 排名类：最贵的物品、最多的分类、最近购买的
- 汇总类：本月/今年花了多少钱、各平台花费对比`;

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
    物品总数: data.items.length,
    闲置中: data.items.filter((i) => i.status === "闲置中").length,
    使用中: data.items.filter((i) => i.status === "使用中").length,
    总价值: data.items.reduce((sum, i) => sum + (i.purchasePrice ?? 0), 0),
    分类列表: data.categories.map((c) => ({
      名称: c.name,
      图标: c.icon ?? "📦",
      物品数: data.items.filter((i) => i.categoryId === c.id).length,
    })),
  };

  return JSON.stringify({ 统计: stats, 物品列表: items }, null, 2);
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
    throw new Error("请先在「我的」页面配置 AI 接口");
  }

  const context = await buildContext();

  const messages: { role: string; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `当前用户的物品数据如下（JSON 格式）：\n\`\`\`json\n${context}\n\`\`\`` },
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

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "抱歉，未能获取回答。";
  return content.trim();
}
