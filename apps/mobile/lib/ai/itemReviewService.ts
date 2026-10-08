/** AI 匣物评价服务：请求、状态写回与连接测试。 */

import { getApiKey, getOcrSettingsAsync, hasAiConsent, type OcrSettings } from "../ocr/ocrService";
import { buildItemReviewSystemPrompt, stripMarkdown } from "./personality";
import { generateId, loadData, nowISO, updateData } from "../storage/jsonStore";
import type { AiReviewFailureCode } from "../types";

const REVIEW_TIMEOUT_MS = 12_000;
const REVIEW_MAX_TOKENS = 128;
const SHORT_FIELD_LIMIT = 100;
const NOTES_LIMIT = 300;

export type ItemReviewRequestResult =
  | { ok: true; review: string; durationMs: number }
  | { ok: false; code: AiReviewFailureCode; status?: number; durationMs: number };

export function getItemReviewFailureMessage(code: AiReviewFailureCode, status?: number): string {
  switch (code) {
    case "not_configured": return "请先配置 AI 服务和 API Key";
    case "authorization_required": return "请先确认 AI 评价数据发送授权";
    case "timeout": return "服务响应超时，请稍后重试";
    case "network": return "网络连接失败，请检查网络后重试";
    case "authentication": return "API Key 无效或没有访问权限";
    case "rate_limited": return "请求过于频繁或额度不足，请稍后重试";
    case "empty_response": return "服务未返回评价内容，请重试";
    case "invalid_response": return "服务返回格式异常，请重试";
    case "http_error": return status ? `AI 服务请求失败（HTTP ${status}）` : "AI 服务请求失败";
  }
}

function truncate(value: string | null, limit: number): string {
  const text = value?.trim() || "未知";
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

export function buildItemReviewContext(item: {
  name: string; brand: string | null; purchasePrice: number | null; purchasePlatform: string | null;
  status: string; notes: string | null;
}, categoryName: string | null): string {
  return [
    `名称: ${truncate(item.name, SHORT_FIELD_LIMIT)}`,
    `分类: ${truncate(categoryName, SHORT_FIELD_LIMIT)}`,
    `价格: ${item.purchasePrice != null ? `¥${item.purchasePrice}` : "未知"}`,
    `状态: ${truncate(item.status, SHORT_FIELD_LIMIT)}`,
    `品牌: ${truncate(item.brand, SHORT_FIELD_LIMIT)}`,
    `平台: ${truncate(item.purchasePlatform, SHORT_FIELD_LIMIT)}`,
    `备注: ${truncate(item.notes, NOTES_LIMIT)}`,
  ].join("\n");
}

export function buildItemReviewRequestBody(
  settings: Pick<OcrSettings, "apiBase" | "model">,
  systemPrompt: string,
  userContent: string
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: settings.model,
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
    max_tokens: REVIEW_MAX_TOKENS,
    temperature: 0.3,
  };
  if (settings.apiBase.toLowerCase().includes("deepseek") || settings.model.toLowerCase().includes("deepseek")) {
    body.thinking = { type: "disabled" };
  }
  return body;
}

export async function requestItemReview(
  settings: Pick<OcrSettings, "apiBase" | "model">,
  apiKey: string,
  systemPrompt: string,
  userContent: string
): Promise<ItemReviewRequestResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REVIEW_TIMEOUT_MS);
  const duration = () => Date.now() - startedAt;

  try {
    const response = await fetch(`${settings.apiBase.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify(buildItemReviewRequestBody(settings, systemPrompt, userContent)),
    });
    if (!response.ok) {
      // 消费错误响应以便连接可复用；绝不把原始正文写入本地数据或展示给用户。
      try { await response.text(); } catch { /* 某些兼容实现不提供错误正文 */ }
      const code: AiReviewFailureCode = response.status === 401 || response.status === 403
        ? "authentication" : response.status === 429 ? "rate_limited" : "http_error";
      return { ok: false, code, status: response.status, durationMs: duration() };
    }
    let result: any;
    try { result = await response.json(); } catch { return { ok: false, code: "invalid_response", durationMs: duration() }; }
    const content = typeof result?.choices?.[0]?.message?.content === "string"
      ? result.choices[0].message.content.trim() : "";
    if (!content) return { ok: false, code: "empty_response", durationMs: duration() };
    const review = stripMarkdown(content).trim();
    return review ? { ok: true, review, durationMs: duration() } : { ok: false, code: "invalid_response", durationMs: duration() };
  } catch (error) {
    return { ok: false, code: error instanceof Error && error.name === "AbortError" ? "timeout" : "network", durationMs: duration() };
  } finally {
    clearTimeout(timeout);
  }
}

async function configuredRequest(systemPrompt: string, userContent: string): Promise<ItemReviewRequestResult> {
  const settings = await getOcrSettingsAsync();
  const apiKey = await getApiKey();
  if (!settings.apiBase.trim() || !settings.model.trim() || !apiKey) return { ok: false, code: "not_configured", durationMs: 0 };
  if (!hasAiConsent(settings, "itemReview")) return { ok: false, code: "authorization_required", durationMs: 0 };
  return requestItemReview(settings, apiKey, systemPrompt, userContent);
}

/** 只发送固定文本，用于验证当前已保存的评价连接。 */
export async function testItemReviewConnection(): Promise<ItemReviewRequestResult> {
  const settings = await getOcrSettingsAsync();
  const systemPrompt = buildItemReviewSystemPrompt(settings.itemReviewFollowPersonality, settings.personalityPreset, settings.personalityCustom);
  return configuredRequest(systemPrompt, "请对以下测试匣物给出一句简短评价：\n名称: AI 连接测试\n分类: 测试\n价格: ¥1\n状态: 使用中\n品牌: 未知\n平台: 未知\n备注: 这是一条固定测试文本，不包含匣物数据。");
}

/** 为指定匣物生成评价；失败状态会写回，且旧请求不会覆盖新请求。 */
export async function generateAndSaveItemReview(itemId: string): Promise<ItemReviewRequestResult | null> {
  const data = await loadData();
  const raw = data.items.find((item) => item.id === itemId);
  if (!raw) return null;
  const settings = await getOcrSettingsAsync();
  if (!settings.itemReviewEnabled) return null;

  const requestId = generateId();
  const startedAt = nowISO();
  let started = false;
  updateData((current) => ({
    ...current,
    items: current.items.map((item) => {
      if (item.id !== itemId) return item;
      // 改匣后的新版本拥有自己的评价任务，旧任务不得抢回状态。
      if (item.updatedAt !== raw.updatedAt) return item;
      started = true;
      return {
        ...item, aiComment: null, aiCommentAt: null, aiReviewStatus: "pending", aiReviewRequestId: requestId,
        aiReviewStartedAt: startedAt, aiReviewError: null,
      };
    }),
  }));
  if (!started) return null;

  const cat = data.categories.find((category) => category.id === raw.categoryId);
  const systemPrompt = buildItemReviewSystemPrompt(settings.itemReviewFollowPersonality, settings.personalityPreset, settings.personalityCustom);
  const outcome = await configuredRequest(systemPrompt, `请评价以下匣物：\n${buildItemReviewContext(raw, cat?.name ?? null)}`);

  updateData((current) => ({
    ...current,
    items: current.items.map((item) => {
      if (item.id !== itemId || item.aiReviewRequestId !== requestId) return item;
      return outcome.ok
        ? { ...item, aiComment: outcome.review, aiCommentAt: nowISO(), aiReviewStatus: "succeeded", aiReviewError: null }
        : { ...item, aiReviewStatus: "failed", aiReviewError: outcome.code };
    }),
  }));
  return outcome;
}
