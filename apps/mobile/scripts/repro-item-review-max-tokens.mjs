/**
 * Repro + fix check for item review empty content.
 * Run: node apps/mobile/scripts/repro-item-review-max-tokens.mjs
 */

function extractReviewContent(apiResponse) {
  return apiResponse.choices?.[0]?.message?.content?.trim() || "";
}

function buildReviewRequestBody({ maxTokens, disableThinking }) {
  const body = {
    model: "deepseek-v4-flash",
    messages: [{ role: "user", content: "请评价" }],
    max_tokens: maxTokens,
    temperature: 0.3,
  };
  if (disableThinking) body.thinking = { type: "disabled" };
  return body;
}

/** Old bug: thinking ON + max_tokens=60 → content empty */
const thinkingModeLowBudget = {
  choices: [
    {
      message: {
        role: "assistant",
        reasoning_content: "思考过程占满 token…",
        content: null,
      },
      finish_reason: "length",
    },
  ],
};

/** Fixed: thinking disabled → content present */
const thinkingDisabled = {
  choices: [
    {
      message: {
        role: "assistant",
        content: "价格适中，日常实用，值得留在匣中。",
      },
      finish_reason: "stop",
    },
  ],
};

const oldBody = buildReviewRequestBody({ maxTokens: 60, disableThinking: false });
const newBody = buildReviewRequestBody({ maxTokens: 512, disableThinking: true });

console.log("old request:", JSON.stringify(oldBody));
console.log("new request:", JSON.stringify(newBody));

const oldWouldSave = extractReviewContent(thinkingModeLowBudget).length > 0;
const newWouldSave = extractReviewContent(thinkingDisabled).length > 0;

console.log(`old path saves comment: ${oldWouldSave}`);
console.log(`new path saves comment: ${newWouldSave}`);

if (oldWouldSave) {
  console.error("FAIL: old path should still be RED");
  process.exit(1);
}
if (!newWouldSave) {
  console.error("FAIL: new path should be GREEN");
  process.exit(1);
}
if (newBody.max_tokens < 256 || newBody.thinking?.type !== "disabled") {
  console.error("FAIL: fixed body shape unexpected", newBody);
  process.exit(1);
}
console.log("GREEN: fixed request shape + content extraction OK");
process.exit(0);
