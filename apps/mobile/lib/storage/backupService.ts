/**
 * 数据备份服务 —— 目录式备份包的导出与导入。
 *
 * 备份包结构（放在匣主选定的文件夹里）：
 *   物匣备份-20261008-143045/
 *     warehouse-data.json      version 3，images 字段为相对名
 *     images/<uuid>.jpg
 *
 * 导入为全量覆盖：备份包中的数据（含图片文件）整体替换本机数据，
 * 图片会以新文件名落地到本机 images/ 目录并改写 JSON 引用。
 */

import { Directory, File } from "expo-file-system";
import {
  DATA_VERSION,
  flushData,
  normalizeWarehouseData,
  replaceData,
  snapshotData,
  type WarehouseData,
} from "./jsonStore";
import {
  imageExtensionOf,
  imageFileName,
  rewriteImageReferences,
  uniqueImageFileNames,
} from "./imagePaths";
import {
  ensureImagesDirectory,
  imagesDirectory,
  nextImageName,
  pruneOrphanImages,
} from "./imageStore";

const BACKUP_JSON_FILENAME = "warehouse-data.json";
const BACKUP_DIR_PREFIX = "物匣备份-";
const BACKUP_IMAGES_DIRNAME = "images";

export interface BackupProgress {
  done: number;
  total: number;
}

export interface ExportSummary {
  dirName: string;
  itemCount: number;
  categoryCount: number;
  imageCount: number;
  missingImages: number;
  bytes: number;
}

export interface ImportSummary {
  itemCount: number;
  categoryCount: number;
  imageCount: number;
  missingImages: number;
  prunedImages: number;
}

export interface BackupSelection {
  dirName: string;
  backedUpAt: string;
  itemCount: number;
  categoryCount: number;
  imageCount: number;
  missingImages: number;
  apply: (onProgress?: (progress: BackupProgress) => void) => Promise<ImportSummary>;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 物匣备份-20261008-143045 */
function backupDirName(now: Date): string {
  return (
    BACKUP_DIR_PREFIX +
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/** 解出 URI 里的真实文件名（SAF 的 content:// 与 iOS 的 file:// 都可能是百分号编码的）。 */
function decodedName(uri: string): string {
  let decoded = uri;
  try {
    decoded = decodeURIComponent(uri);
  } catch { /* 编码异常时退回原串 */ }
  return decoded.replace(/\\/g, "/").split("/").pop() ?? "";
}

function childFiles(directory: Directory | null): File[] {
  if (!directory) return [];
  try {
    return directory.list().filter((entry): entry is File => entry instanceof File);
  } catch {
    return [];
  }
}

function findChildDirectory(directory: Directory, name: string): Directory | null {
  try {
    const found = directory
      .list()
      .find((entry) => entry instanceof Directory && decodedName(entry.uri) === name);
    return found instanceof Directory ? found : null;
  } catch {
    return null;
  }
}

function isPickerCancelled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /cancel/i.test(message);
}

/** 选择文件夹；用户取消时返回 null。 */
async function pickDirectory(): Promise<Directory | null> {
  try {
    return await Directory.pickDirectoryAsync();
  } catch (error) {
    if (isPickerCancelled(error)) return null;
    throw error;
  }
}

function createUniqueDirectory(parent: Directory, name: string): Directory {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const candidate = attempt === 1 ? name : `${name}-${attempt}`;
    try {
      return parent.createDirectory(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `无法在所选位置创建备份文件夹：${lastError instanceof Error ? lastError.message : "未知错误"}`
  );
}

function referencedImageNames(data: WarehouseData): string[] {
  return uniqueImageFileNames(data.items.flatMap((item) => item.images ?? []));
}

/**
 * 导出备份包：选择保存位置后，写入 warehouse-data.json 与 images/ 下的全部图片。
 * 返回 null 表示匣主取消了选择。
 */
export async function exportBackup(
  onProgress?: (progress: BackupProgress) => void
): Promise<ExportSummary | null> {
  const parent = await pickDirectory();
  if (!parent) return null;

  await flushData();
  const data = await snapshotData();
  const names = referencedImageNames(data);
  const directory = createUniqueDirectory(parent, backupDirName(new Date()));
  const imagesDir = directory.createDirectory(BACKUP_IMAGES_DIRNAME);

  directory.createFile(BACKUP_JSON_FILENAME, "application/json").write(JSON.stringify(data, null, 2));

  let imageCount = 0;
  let missingImages = 0;
  let bytes = 0;
  let done = 0;
  onProgress?.({ done, total: names.length });

  for (const name of names) {
    try {
      const source = new File(imagesDirectory() + name);
      if (!source.exists) {
        missingImages += 1;
      } else {
        const size = source.info().size ?? 0;
        await source.copy(imagesDir);
        imageCount += 1;
        bytes += size;
      }
    } catch {
      missingImages += 1;
    }
    done += 1;
    onProgress?.({ done, total: names.length });
  }

  return {
    dirName: decodedName(directory.uri),
    itemCount: data.items.length,
    categoryCount: data.categories.length,
    imageCount,
    missingImages,
    bytes,
  };
}

/** 在选中的目录（或其唯一子目录）中定位备份 JSON。 */
function locateBackupFile(directory: Directory): { holder: Directory; file: File } | null {
  const direct = childFiles(directory).find((entry) => decodedName(entry.uri) === BACKUP_JSON_FILENAME);
  if (direct) return { holder: directory, file: direct };

  let subdirectories: Directory[] = [];
  try {
    subdirectories = directory
      .list()
      .filter((entry): entry is Directory => entry instanceof Directory);
  } catch {
    return null;
  }
  for (const child of subdirectories) {
    const found = childFiles(child).find((entry) => decodedName(entry.uri) === BACKUP_JSON_FILENAME);
    if (found) return { holder: child, file: found };
  }
  return null;
}

/**
 * 选择备份包并解析出预览信息；返回 null 表示匣主取消了选择。
 * 真正的覆盖动作由返回值的 apply() 触发（UI 应先让匣主确认）。
 */
export async function selectBackup(): Promise<BackupSelection | null> {
  const picked = await pickDirectory();
  if (!picked) return null;

  const located = locateBackupFile(picked);
  if (!located) {
    throw new Error(`所选文件夹里没有找到 ${BACKUP_JSON_FILENAME}，请选择备份包文件夹`);
  }

  const data = normalizeWarehouseData(JSON.parse(await located.file.text()));
  const imagesDir = findChildDirectory(located.holder, BACKUP_IMAGES_DIRNAME);
  const available = new Set(childFiles(imagesDir).map((entry) => decodedName(entry.uri)));
  const names = referencedImageNames(data);
  const missingImages = names.filter((name) => !available.has(name)).length;

  return {
    dirName: decodedName(located.holder.uri),
    backedUpAt: data.lastModified,
    itemCount: data.items.length,
    categoryCount: data.categories.length,
    imageCount: names.length - missingImages,
    missingImages,
    apply: (onProgress) => applyBackup(data, imagesDir, names, onProgress),
  };
}

async function applyBackup(
  data: WarehouseData,
  imagesDir: Directory | null,
  names: string[],
  onProgress?: (progress: BackupProgress) => void
): Promise<ImportSummary> {
  await ensureImagesDirectory();

  const sourcesByName = new Map(childFiles(imagesDir).map((entry) => [decodedName(entry.uri), entry]));
  const mapping = new Map<string, string>();
  let missingImages = 0;
  let done = 0;
  onProgress?.({ done, total: names.length });

  for (const name of names) {
    const source = sourcesByName.get(name);
    if (!source) {
      missingImages += 1;
    } else {
      try {
        const relativeName = nextImageName(imageExtensionOf(name));
        await source.copy(new File(imagesDirectory() + imageFileName(relativeName)));
        mapping.set(name, relativeName);
      } catch {
        missingImages += 1;
      }
    }
    done += 1;
    onProgress?.({ done, total: names.length });
  }

  const rewritten: WarehouseData = {
    ...data,
    version: DATA_VERSION,
    items: rewriteImageReferences(data.items, mapping),
  };

  await replaceData(rewritten);

  // 有图片缺失时保留本地残留文件，避免在备份不完整的情况下把唯一副本也清掉。
  const prunedImages = missingImages === 0 ? await pruneOrphanImages(referencedImageNames(rewritten)) : 0;

  return {
    itemCount: rewritten.items.length,
    categoryCount: rewritten.categories.length,
    imageCount: mapping.size,
    missingImages,
    prunedImages,
  };
}
