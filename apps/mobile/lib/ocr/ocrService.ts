/**
 * OCR 服务 —— 上传订单截图，调用 AI 视觉模型提取购买信息。
 *
 * 默认使用 OpenAI GPT-4o 视觉能力，也可替换为其他兼容接口。
 * API Key 持久化到应用文档目录。
 */

import * as FileSystem from "expo-file-system/legacy";

export interface OcrResult {
  /** 商品名称 */
  name: string;
  /** 品牌 */
  brand: string;
  /** 购买价格（数字，单位元） */
  purchasePrice: number;
  /** 购买平台 */
  purchasePlatform: string;
  /** 店铺名称 */
  storeName: string;
  /** 购买日期 YYYY-MM-DD */
  purchaseDate: string;
  /** 数量 */
  quantity: number;
}

const OCR_SETTINGS_FILENAME = "warehouse-ocr-settings.json";

export interface OcrSettings {
  apiKey: string;
  /** 自定义 API 地址，留空使用 OpenAI 官方 */
  apiBase: string;
  /** 模型名称 */
  model: string;
}

const DEFAULT_SETTINGS: OcrSettings = {
  apiKey: "",
  apiBase: "https://api.openai.com/v1",
  model: "gpt-4o",
};

let ocrCache: OcrSettings | null = null;

// ---- file-based storage ----
async function readSettingsFile(): Promise<string | null> {
  try {
    const filePath = FileSystem.documentDirectory + OCR_SETTINGS_FILENAME;
    const info = await FileSystem.getInfoAsync(filePath);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(filePath);
  } catch {
    return null;
  }
}

async function writeSettingsFile(content: string): Promise<void> {
  try {
    const filePath = FileSystem.documentDirectory + OCR_SETTINGS_FILENAME;
    await FileSystem.writeAsStringAsync(filePath, content);
  } catch { /* ignore */ }
}

export function getOcrSettings(): OcrSettings {
  // 同步返回缓存值（首次调用时可能为默认值，调用者应在页面初始化时使用 getOcrSettingsAsync）
  if (ocrCache) return ocrCache;
  return { ...DEFAULT_SETTINGS };
}

/** 异步加载 OCR 设置（用于页面初始化时恢复持久化配置） */
export async function getOcrSettingsAsync(): Promise<OcrSettings> {
  if (ocrCache) return ocrCache;
  try {
    const raw = await readSettingsFile();
    if (raw) {
      const parsed: OcrSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      ocrCache = parsed;
      return parsed;
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export async function saveOcrSettings(s: OcrSettings): Promise<void> {
  ocrCache = { ...s };
  try {
    await writeSettingsFile(JSON.stringify(s));
  } catch { /* ignore */ }
}

const SYSTEM_PROMPT = `你是一个订单截图解析助手。你的任务是从电商订单截图中提取购买信息。

请严格只返回一个 JSON 对象，不要包含任何解释文字或 markdown 标记。

JSON 对象的格式如下：
{
  "name": "商品名称",
  "brand": "品牌（如果能识别，否则空字符串）",
  "purchasePrice": 数字价格（单位元，如 29.9）,
  "purchasePlatform": "购买平台（淘宝/天猫/京东/拼多多/抖音/其他）",
  "storeName": "店铺名称（如能识别）",
  "purchaseDate": "购买日期，格式 YYYY-MM-DD",
  "quantity": 数量数字（默认为1）
}

注意：
- 所有字段都必须存在，无法识别时 name 用空字符串，价格用 0，平台用 "未知"，日期用空字符串
- purchasePrice 必须是纯数字，不要带货币符号
- purchaseDate 必须是 YYYY-MM-DD 格式
- 只返回 JSON，不要有任何其他内容`;

/**
 * 对订单截图执行 OCR 识别
 * @param base64Image 图片的 base64 编码（不含 data:image/... 前缀）
 * @param mimeType 图片 MIME 类型，如 "image/png"
 */
export async function recognizeOrderScreenshot(
  base64Image: string,
  mimeType: string = "image/png"
): Promise<OcrResult> {
  const settings = await getOcrSettingsAsync();

  if (!settings.apiKey) {
    throw new Error("请先在「我的」页面配置 OpenAI API Key");
  }

  const response = await fetch(`${settings.apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "请从这张订单截图中提取购买信息" },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API 请求失败 (${response.status}): ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  // 提取 JSON（模型可能在前后加了 markdown 或空白）
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`无法解析识别结果: ${content.slice(0, 200)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    name: parsed.name || "",
    brand: parsed.brand || "",
    purchasePrice: typeof parsed.purchasePrice === "number" ? parsed.purchasePrice : 0,
    purchasePlatform: parsed.purchasePlatform || "未知",
    storeName: parsed.storeName || "",
    purchaseDate: parsed.purchaseDate || "",
    quantity: typeof parsed.quantity === "number" && parsed.quantity > 0 ? parsed.quantity : 1,
  };
}
