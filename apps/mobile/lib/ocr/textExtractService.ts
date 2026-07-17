/**
 * 设备端 OCR —— 从订单截图提取文字（中文优先）。
 * 依赖原生模块，需在 dev client / EAS Build 中使用。
 */

import {
  extractTextFromImage,
  isSupported,
  TextRecognitionScript,
  RecognitionLevel,
} from "@zhanziyang/expo-text-extractor";
import { Platform } from "react-native";

/**
 * 从图片 URI 提取订单相关文字，按行拼接以尽量保留阅读顺序。
 */
export async function extractOrderText(imageUri: string): Promise<string> {
  if (!isSupported) {
    throw new Error("当前设备不支持本地文字识别，请使用真机并重建开发客户端");
  }

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
}
