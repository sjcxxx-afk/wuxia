/**
 * 设备端 OCR —— 从订单截图提取文字（中文优先）。
 * 依赖原生模块，需在含内置中文模型的 EAS Build / 真机中使用。
 */

import {
  extractTextFromImage,
  isSupported,
  TextRecognitionScript,
  RecognitionLevel,
} from "@zhanziyang/expo-text-extractor";
import { Platform } from "react-native";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isModelDownloadingError(message: string): boolean {
  return /optional module|model to be downloaded|请等待/i.test(message);
}

function toUserFacingError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err ?? "未知错误");
  if (isModelDownloadingError(message)) {
    return new Error(
      "中文识别模型尚未就绪。请保持网络畅通后重试；若反复失败，请重装最新版 APK（内置模型）"
    );
  }
  if (err instanceof Error) return err;
  return new Error(message);
}

/**
 * 从图片 URI 提取订单相关文字，按行拼接以尽量保留阅读顺序。
 */
export async function extractOrderText(imageUri: string): Promise<string> {
  if (!isSupported) {
    throw new Error("当前设备不支持本地文字识别，请使用真机并重建开发客户端");
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const lines = await extractTextFromImage(imageUri, {
        script: TextRecognitionScript.CHINESE,
        languages: ["zh-Hans", "zh-Hant"],
        usesLanguageCorrection: true,
        recognitionLevel: RecognitionLevel.ACCURATE,
        ...(Platform.OS === "ios" ? { minimumTextHeight: 0.02 } : {}),
      });

      const text = lines
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n");

      if (!text) {
        throw new Error("未能从图片中识别到文字，请换一张更清晰的订单截图");
      }

      return text;
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err ?? "");
      if (!isModelDownloadingError(message) || attempt === MAX_ATTEMPTS) {
        throw toUserFacingError(err);
      }
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw toUserFacingError(lastError);
}
