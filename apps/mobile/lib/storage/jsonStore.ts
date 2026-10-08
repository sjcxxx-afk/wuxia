import * as FileSystem from "expo-file-system/legacy";
import type { AiReviewFailureCode, AiReviewStatus } from "../types";
import { toRelativeImageName } from "./imagePaths";

const DATA_FILENAME = "warehouse-data.json";
const TEMP_FILENAME = "warehouse-data.tmp";
const CORRUPT_PREFIX = "warehouse-data.corrupt-";

/**
 * 已废弃文件（同步设置、旧版本地备份轮转），加载时 best-effort 清理一次。
 * 这些文件在仓库里已经没有读写方，留着只会让人误以为数据仍被备份。
 */
const LEGACY_FILENAMES = ["warehouse-sync-settings.json", "warehouse-data.backup.1.json"];
const LEGACY_FILENAME_PREFIXES = ["warehouse-data.backup."];

export const DATA_VERSION = 3;

export interface WarehouseData {
  version: number;
  lastModified: string;
  profile: ProfileData;
  categories: CategoryData[];
  items: ItemData[];
}

export interface ProfileData {
  nickname: string;
  avatarUrl: string | null;
}

export interface CategoryData {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  sortOrder: number;
  customFields: { id: string; name: string; type: string; sortOrder: number }[];
  createdAt: string;
  updatedAt: string;
}

export interface ItemData {
  id: string;
  name: string;
  categoryId: string | null;
  brand: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  purchasePlatform: string | null;
  storeName: string | null;
  location: string | null;
  quantity: number;
  status: string;
  notes: string | null;
  images: string[];
  customValues: Record<string, string>;
  aiComment: string | null;
  aiCommentAt: string | null;
  aiReviewStatus: AiReviewStatus;
  aiReviewRequestId: string | null;
  aiReviewStartedAt: string | null;
  aiReviewError: AiReviewFailureCode | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataRecoveryState {
  hasCorruptData: boolean;
  message: string | null;
}

const EMPTY_DATA: WarehouseData = {
  version: DATA_VERSION,
  lastModified: new Date().toISOString(),
  profile: { nickname: "", avatarUrl: null },
  categories: [],
  items: [],
};

let cache: WarehouseData | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let writeChain: Promise<void> = Promise.resolve();
let recoveryState: DataRecoveryState = { hasCorruptData: false, message: null };
let legacyCleaned = false;

function dataPath(): string {
  return FileSystem.documentDirectory + DATA_FILENAME;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * 归一化任意来源的数据（本地文件、备份包）：
 * 补齐缺失字段，把 v2 及更早的图片绝对路径改写为 `images/<文件名>`。
 */
export function normalizeWarehouseData(value: unknown): WarehouseData {
  if (!isRecord(value) || !Array.isArray(value.items) || !Array.isArray(value.categories)) {
    throw new Error("数据文件格式无效");
  }
  const raw = value as Partial<WarehouseData>;
  const categories = raw.categories ?? [];
  const items = raw.items ?? [];
  return {
    version: DATA_VERSION,
    lastModified: typeof raw.lastModified === "string" ? raw.lastModified : nowISO(),
    profile: {
      nickname: raw.profile?.nickname ?? "",
      avatarUrl: raw.profile?.avatarUrl ?? null,
    },
    categories: categories.map((category) => ({
      ...category,
      customFields: category.customFields ?? [],
    })),
    items: items.map((item) => ({
      ...item,
      images: normalizeImageList(item.images),
      customValues: item.customValues ?? {},
      aiComment: item.aiComment ?? null,
      aiCommentAt: item.aiCommentAt ?? null,
      aiReviewStatus: isAiReviewStatus(item.aiReviewStatus) ? item.aiReviewStatus : item.aiComment ? "succeeded" : "idle",
      aiReviewRequestId: typeof item.aiReviewRequestId === "string" ? item.aiReviewRequestId : null,
      aiReviewStartedAt: typeof item.aiReviewStartedAt === "string" ? item.aiReviewStartedAt : null,
      aiReviewError: isAiReviewFailureCode(item.aiReviewError) ? item.aiReviewError : null,
    })),
  };
}

function normalizeImageList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const entry of value) {
    const name = toRelativeImageName(String(entry ?? ""));
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

function isAiReviewStatus(value: unknown): value is AiReviewStatus {
  return value === "idle" || value === "pending" || value === "succeeded" || value === "failed";
}

function isAiReviewFailureCode(value: unknown): value is AiReviewFailureCode {
  return value === "not_configured" || value === "authorization_required" || value === "timeout" ||
    value === "network" || value === "authentication" || value === "rate_limited" ||
    value === "http_error" || value === "empty_response" || value === "invalid_response";
}

async function readFile(path: string): Promise<string | null> {
  const info = await FileSystem.getInfoAsync(path);
  return info.exists ? FileSystem.readAsStringAsync(path) : null;
}

async function writeDataFile(content: string): Promise<void> {
  const tempPath = FileSystem.documentDirectory + TEMP_FILENAME;
  await FileSystem.writeAsStringAsync(tempPath, content);
  await FileSystem.deleteAsync(dataPath(), { idempotent: true });
  await FileSystem.moveAsync({ from: tempPath, to: dataPath() });
}

/** 损坏的数据文件改名保留，避免后续写盘把它彻底覆盖掉。 */
async function preserveCorruptFile(): Promise<string | null> {
  const stamp = nowISO().replace(/[:.]/g, "-");
  const target = FileSystem.documentDirectory + CORRUPT_PREFIX + stamp + ".json";
  try {
    const info = await FileSystem.getInfoAsync(dataPath());
    if (!info.exists) return null;
    await FileSystem.moveAsync({ from: dataPath(), to: target });
    return CORRUPT_PREFIX + stamp + ".json";
  } catch {
    return null;
  }
}

/** 清理已废弃的同步设置与备份文件（best-effort，只做一次）。 */
async function cleanupLegacyFiles(): Promise<void> {
  if (legacyCleaned) return;
  legacyCleaned = true;
  try {
    const names = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory!);
    for (const name of names) {
      const isLegacy =
        LEGACY_FILENAMES.includes(name) ||
        LEGACY_FILENAME_PREFIXES.some((prefix) => name.startsWith(prefix));
      if (!isLegacy) continue;
      await FileSystem.deleteAsync(FileSystem.documentDirectory + name, { idempotent: true });
    }
  } catch { /* ignore */ }
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function loadData(): Promise<WarehouseData> {
  if (cache) return cache;
  try {
    const content = await readFile(dataPath());
    if (!content) {
      cache = { ...EMPTY_DATA, profile: { ...EMPTY_DATA.profile } };
      await flushData();
      void cleanupLegacyFiles();
      return cache;
    }
    cache = normalizeWarehouseData(JSON.parse(content));
    recoveryState = { hasCorruptData: false, message: null };
    void cleanupLegacyFiles();
    return cache;
  } catch (error) {
    const preserved = await preserveCorruptFile();
    recoveryState = {
      hasCorruptData: true,
      message: preserved
        ? `${error instanceof Error ? error.message : "无法读取本地数据"}（原文件已保留为 ${preserved}）`
        : error instanceof Error ? error.message : "无法读取本地数据",
    };
    cache = { ...EMPTY_DATA, profile: { ...EMPTY_DATA.profile } };
    return cache;
  }
}

export function getDataRecoveryState(): DataRecoveryState {
  return recoveryState;
}

export function getCachedData(): WarehouseData | null {
  return cache;
}

/** 当前数据的深拷贝，用于导出等只读场景。 */
export async function snapshotData(): Promise<WarehouseData> {
  return JSON.parse(JSON.stringify(await loadData())) as WarehouseData;
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flushData(), 300);
}

export async function flushData(): Promise<void> {
  if (!cache) return;
  cache.lastModified = nowISO();
  const content = JSON.stringify(cache, null, 2);
  writeChain = writeChain.catch(() => undefined).then(() => writeDataFile(content));
  return writeChain;
}

export function updateData(updater: (data: WarehouseData) => WarehouseData): WarehouseData {
  if (!cache) throw new Error("Data not loaded. Call loadData() first.");
  cache = updater(cache);
  scheduleSave();
  return cache;
}

/** 备份导入：整体替换本地数据并立即落盘。 */
export async function replaceData(next: WarehouseData): Promise<void> {
  cache = normalizeWarehouseData(JSON.parse(JSON.stringify(next)));
  recoveryState = { hasCorruptData: false, message: null };
  await flushData();
}

/** Test and recovery helper: the next load reads the on-disk file again. */
export function resetCache(): void {
  cache = null;
}
