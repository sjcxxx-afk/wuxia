/**
 * OCR 服务 —— 本地抽文字 + 文本大模型结构化提取购买信息。
 *
 * API Key / Base / 模型持久化到应用文档目录，可与 DeepSeek 等纯文本模型配合。
 */

import * as FileSystem from "expo-file-system/legacy";
import type { PersonalityPreset } from "../ai/personality";
import { extractOrderText } from "./textExtractService";

export type { PersonalityPreset };

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
  /** 添加/编辑后自动生成 AI 评价 */
  itemReviewEnabled: boolean;
  /** 匣灵性格预设 */
  personalityPreset: PersonalityPreset;
  /** 自定义性格描述（preset 为 custom 时使用，最多 200 字） */
  personalityCustom: string;
  /** 匣物评价是否跟随匣灵性格 */
  itemReviewFollowPersonality: boolean;
}

const DEFAULT_SETTINGS: OcrSettings = {
  apiKey: "",
  apiBase: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  itemReviewEnabled: false,
  personalityPreset: "warm",
  personalityCustom: "",
  itemReviewFollowPersonality: true,
};

let ocrCache: OcrSettings | null = null;

export type RecognizeProgress = "extracting" | "parsing";

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
      const parsedRaw = JSON.parse(raw);
      const parsed: OcrSettings = {
        ...DEFAULT_SETTINGS,
        ...parsedRaw,
        itemReviewEnabled: parsedRaw.itemReviewEnabled ?? false,
        personalityPreset: parsedRaw.personalityPreset ?? "warm",
        personalityCustom: parsedRaw.personalityCustom ?? "",
        itemReviewFollowPersonality: parsedRaw.itemReviewFollowPersonality ?? true,
      };
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

const SYSTEM_PROMPT = `你是一个订单信息解析助手。你的任务是根据电商订单截图的 OCR 文字提取购买信息。

OCR 文字可能存在乱序、漏字或噪声，请结合电商订单常见版式尽量推断。

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
- purchasePrice 必须是纯数字，不要带货币符号；优先取实付/合计金额，而非优惠前原价
- purchaseDate 必须是 YYYY-MM-DD 格式
- 只返回 JSON，不要有任何其他内容`;

/**
 * 对订单截图执行本地 OCR + 文本大模型结构化识别
 * @param imageUri 本地图片 URI
 * @param onProgress 可选进度回调（提取文字 / AI 解析）
 */
export async function recognizeOrderScreenshot(
  imageUri: string,
  onProgress?: (stage: RecognizeProgress) => void
): Promise<OcrResult> {
  const settings = await getOcrSettingsAsync();

  if (!settings.apiKey) {
    throw new Error("请先在设置中配置 API Key");
  }

  onProgress?.("extracting");
  const ocrText = await extractOrderText(imageUri);

  onProgress?.("parsing");
  const response = await fetch(`${settings.apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `请根据以下订单截图 OCR 文字提取购买信息：\n\n${ocrText}`,
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
