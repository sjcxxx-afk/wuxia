jest.mock("../../ocr/ocrService", () => ({}));
jest.mock("../../storage/jsonStore", () => ({}));
jest.mock("../../storage/syncService", () => ({}));

import {
  buildItemReviewContext,
  buildItemReviewRequestBody,
  requestItemReview,
} from "../itemReviewService";

const settings = { apiBase: "https://api.deepseek.com/v1", model: "deepseek-v4-flash" };
const systemPrompt = "请简短评价";
const userContent = "请评价测试匣物";
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

test("DeepSeek 评价请求关闭 thinking 并限制输出 token", () => {
  const body = buildItemReviewRequestBody(settings, systemPrompt, userContent);
  expect(body.max_tokens).toBe(128);
  expect(body.thinking).toEqual({ type: "disabled" });
});

test("长备注会被截断，避免拖慢评价请求", () => {
  const context = buildItemReviewContext({
    name: "测试", brand: null, purchasePrice: null, purchasePlatform: null, status: "使用中", notes: "a".repeat(400),
  }, null);
  expect(context).toContain("备注: " + "a".repeat(300) + "…");
  expect(context).not.toContain("a".repeat(301));
});

test("成功响应返回评价内容和耗时", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: " 很实用，值得留存。 " } }] }) });
  await expect(requestItemReview(settings, "key", systemPrompt, userContent)).resolves.toMatchObject({ ok: true, review: "很实用，值得留存。" });
});

test.each([
  [401, "authentication"],
  [429, "rate_limited"],
  [500, "http_error"],
])("HTTP %s 被分类为 %s", async (status, code) => {
  fetchMock.mockResolvedValue({ ok: false, status });
  await expect(requestItemReview(settings, "key", systemPrompt, userContent)).resolves.toMatchObject({ ok: false, code, status });
});

test("空内容不会被静默当成成功", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: null } }] }) });
  await expect(requestItemReview(settings, "key", systemPrompt, userContent)).resolves.toMatchObject({ ok: false, code: "empty_response" });
});

test("超时会返回可重试的 timeout 状态", async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    });
  }));
  const result = requestItemReview(settings, "key", systemPrompt, userContent);
  await jest.advanceTimersByTimeAsync(12_000);
  await expect(result).resolves.toMatchObject({ ok: false, code: "timeout" });
  jest.useRealTimers();
});
