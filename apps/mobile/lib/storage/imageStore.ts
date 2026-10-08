/**
 * 图片存储服务 —— 把用户选择的图片压缩后复制到应用文档目录，JSON 中只保存相对名。
 *
 * 文件位于 documentDirectory/images/ 下，命名为 UUID + 扩展名；
 * JSON 里存 `images/<文件名>`，渲染与落盘时由 resolveImageUri() 拼上当前设备的文档目录，
 * 因此备份包换机导入后路径依然有效。
 */

import * as FileSystem from "expo-file-system/legacy";
import { Image as ReactNativeImage } from "react-native";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import {
  IMAGES_DIR_NAME,
  imageExtensionOf,
  imageFileName,
  isAbsoluteImageUri,
  isInlineOrRemoteUri,
  normalizeImageExtension,
  toRelativeImageName,
} from "./imagePaths";

const IMAGES_DIR = FileSystem.documentDirectory + IMAGES_DIR_NAME + "/";

/** 导出/备份时的最长边上限，避免相册原图（数 MB/张）无限堆积。 */
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.8;

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function saveFormatOf(extension: string): SaveFormat {
  if (extension === ".png") return SaveFormat.PNG;
  if (extension === ".webp") return SaveFormat.WEBP;
  return SaveFormat.JPEG;
}

/** 持久化图片目录（绝对路径，带结尾斜杠）。 */
export function imagesDirectory(): string {
  return IMAGES_DIR;
}

/**
 * 相对名 → 可直接渲染的 URI。
 * 相册临时 URI、content://、data:、http(s): 一律原样返回（它们已经指向内容本身）。
 */
export function resolveImageUri(value: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (isAbsoluteImageUri(trimmed)) return trimmed;
  return IMAGES_DIR + imageFileName(trimmed);
}

/** 生成一个新的持久化文件相对名。 */
export function nextImageName(extension: string): string {
  return IMAGES_DIR_NAME + "/" + generateId() + normalizeImageExtension(extension);
}

/** 确保持久化图片目录存在。 */
export async function ensureImagesDirectory(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(IMAGES_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
    }
  } catch { /* ignore */ }
}

function readImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ReactNativeImage.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

/**
 * 缩到最长边 MAX_IMAGE_EDGE 并重新编码，落到缓存目录后返回新 URI。
 * 任何一步失败都返回原 URI —— 图片宁可大一点，也不能丢。
 */
async function compressToCache(uri: string): Promise<string> {
  try {
    const context = ImageManipulator.manipulate(uri);
    try {
      const { width, height } = await readImageSize(uri);
      const longest = Math.max(width, height);
      if (longest > MAX_IMAGE_EDGE) {
        const scale = MAX_IMAGE_EDGE / longest;
        context.resize({
          width: Math.max(1, Math.round(width * scale)),
          height: Math.max(1, Math.round(height * scale)),
        });
      }
    } catch {
      // 拿不到原始尺寸时按宽度缩放，纵向图会略高于上限但不影响可用性。
      context.resize({ width: MAX_IMAGE_EDGE });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      compress: JPEG_QUALITY,
      format: saveFormatOf(imageExtensionOf(uri)),
    });
    return saved.uri;
  } catch (e) {
    console.warn("Image compression skipped:", e);
    return uri;
  }
}

/**
 * 将选中的临时图片 URI 压缩后复制到持久化目录，返回相对名数组（`images/<文件名>`）。
 * 已经是持久化相对名的值原样归一返回，不会重复复制。
 */
export async function saveImages(uris: string[]): Promise<string[]> {
  if (uris.length === 0) return [];

  await ensureImagesDirectory();
  const result: string[] = [];

  for (const uri of uris) {
    if (!uri) continue;
    if (!isAbsoluteImageUri(uri) || uri.startsWith(IMAGES_DIR)) {
      const kept = toRelativeImageName(uri);
      if (kept) result.push(kept);
      continue;
    }
    try {
      const source = await compressToCache(uri);
      const relativeName = nextImageName(imageExtensionOf(source));
      await FileSystem.copyAsync({ from: source, to: IMAGES_DIR + imageFileName(relativeName) });
      result.push(relativeName);
    } catch (e) {
      console.error("Failed to save image:", e);
    }
  }

  return result;
}

/**
 * 删除指定的图片文件，接受相对名或绝对路径。
 */
export async function deleteImages(paths: string[]): Promise<void> {
  for (const path of paths) {
    try {
      const target = resolveImageUri(path);
      if (!target || isInlineOrRemoteUri(path)) continue;
      const info = await FileSystem.getInfoAsync(target);
      if (info.exists) {
        await FileSystem.deleteAsync(target, { idempotent: true });
      }
    } catch (e) {
      console.error("Failed to delete image:", e);
    }
  }
}

/**
 * 清理没有任何匣物引用的图片文件（导入覆盖后会产生这类残留）。
 */
export async function pruneOrphanImages(referenced: string[]): Promise<number> {
  try {
    const keep = new Set(referenced.map(imageFileName).filter(Boolean));
    const names = await FileSystem.readDirectoryAsync(IMAGES_DIR);
    let removed = 0;
    for (const name of names) {
      if (keep.has(name)) continue;
      await FileSystem.deleteAsync(IMAGES_DIR + name, { idempotent: true });
      removed += 1;
    }
    return removed;
  } catch {
    return 0;
  }
}
