/**
 * 图片存储服务 —— 将用户选择的图片复制到应用文档目录，提供持久化路径。
 *
 * 图片存储在 documentDirectory/images/ 下，文件名为 UUID + 原始扩展名。
 * JSON 中只存储相对路径，不内嵌 base64。
 */

import * as FileSystem from "expo-file-system/legacy";

const IMAGES_DIR = FileSystem.documentDirectory + "images/";

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getExtension(uri: string): string {
  const parts = uri.split(".");
  const ext = parts[parts.length - 1]?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return ".jpg";
  if (ext === "png") return ".png";
  if (ext === "webp") return ".webp";
  return ".jpg";
}

async function ensureDir(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(IMAGES_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
    }
  } catch { /* ignore */ }
}

/**
 * 将选中的临时图片 URI 复制到持久化目录，返回持久化后的 URI 数组。
 */
export async function saveImages(uris: string[]): Promise<string[]> {
  if (uris.length === 0) return uris;

  await ensureDir();
  const result: string[] = [];

  for (const uri of uris) {
    try {
      const filename = generateId() + getExtension(uri);
      const destPath = IMAGES_DIR + filename;
      await FileSystem.copyAsync({ from: uri, to: destPath });
      result.push(destPath);
    } catch (e) {
      console.error("Failed to save image:", e);
    }
  }

  return result;
}

/**
 * 删除指定的图片文件。
 */
export async function deleteImages(paths: string[]): Promise<void> {
  for (const path of paths) {
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        await FileSystem.deleteAsync(path, { idempotent: true });
      }
    } catch (e) {
      console.error("Failed to delete image:", e);
    }
  }
}
