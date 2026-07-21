import * as FileSystem from "expo-file-system/legacy";

const DATA_FILENAME = "warehouse-data.json";
const TEMP_FILENAME = "warehouse-data.tmp";
const BACKUP_PREFIX = "warehouse-data.backup.";
const BACKUP_COUNT = 3;

export interface DeletedRecord {
  id: string;
  deletedAt: string;
}

export interface WarehouseData {
  version: number;
  lastModified: string;
  profile: ProfileData;
  categories: CategoryData[];
  items: ItemData[];
  /** v2: deletion tombstones make deletes propagate across devices. */
  deletedItems: DeletedRecord[];
  deletedCategories: DeletedRecord[];
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
  createdAt: string;
  updatedAt: string;
}

export interface BackupInfo {
  slot: number;
  path: string;
  modifiedAt: number;
}

export interface DataRecoveryState {
  hasCorruptData: boolean;
  message: string | null;
}

const EMPTY_DATA: WarehouseData = {
  version: 2,
  lastModified: new Date().toISOString(),
  profile: { nickname: "", avatarUrl: null },
  categories: [],
  items: [],
  deletedItems: [],
  deletedCategories: [],
};

let cache: WarehouseData | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let writeChain: Promise<void> = Promise.resolve();
let recoveryState: DataRecoveryState = { hasCorruptData: false, message: null };

function dataPath(): string {
  return FileSystem.documentDirectory + DATA_FILENAME;
}

function backupPath(slot: number): string {
  return FileSystem.documentDirectory + BACKUP_PREFIX + slot + ".json";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeWarehouseData(value: unknown): WarehouseData {
  if (!isRecord(value) || !Array.isArray(value.items) || !Array.isArray(value.categories)) {
    throw new Error("数据文件格式无效");
  }
  const raw = value as Partial<WarehouseData>;
  const categories = raw.categories ?? [];
  const items = raw.items ?? [];
  return {
    version: 2,
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
      images: item.images ?? [],
      customValues: item.customValues ?? {},
      aiComment: item.aiComment ?? null,
      aiCommentAt: item.aiCommentAt ?? null,
    })),
    deletedItems: Array.isArray(raw.deletedItems) ? raw.deletedItems.filter(isDeletedRecord) : [],
    deletedCategories: Array.isArray(raw.deletedCategories)
      ? raw.deletedCategories.filter(isDeletedRecord)
      : [],
  };
}

function isDeletedRecord(value: unknown): value is DeletedRecord {
  return isRecord(value) && typeof value.id === "string" && typeof value.deletedAt === "string";
}

async function readFile(path: string): Promise<string | null> {
  const info = await FileSystem.getInfoAsync(path);
  return info.exists ? FileSystem.readAsStringAsync(path) : null;
}

async function rotateBackups(): Promise<void> {
  for (let slot = BACKUP_COUNT; slot >= 2; slot -= 1) {
    const previous = backupPath(slot - 1);
    const target = backupPath(slot);
    const info = await FileSystem.getInfoAsync(previous);
    if (info.exists) {
      await FileSystem.copyAsync({ from: previous, to: target });
    }
  }
  const current = await FileSystem.getInfoAsync(dataPath());
  if (current.exists) {
    await FileSystem.copyAsync({ from: dataPath(), to: backupPath(1) });
  }
}

async function writeDataFile(content: string): Promise<void> {
  const tempPath = FileSystem.documentDirectory + TEMP_FILENAME;
  await FileSystem.writeAsStringAsync(tempPath, content);
  await rotateBackups();
  await FileSystem.deleteAsync(dataPath(), { idempotent: true });
  await FileSystem.moveAsync({ from: tempPath, to: dataPath() });
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
      return cache;
    }
    cache = normalizeWarehouseData(JSON.parse(content));
    recoveryState = { hasCorruptData: false, message: null };
    return cache;
  } catch (error) {
    recoveryState = {
      hasCorruptData: true,
      message: error instanceof Error ? error.message : "无法读取本地数据",
    };
    cache = { ...EMPTY_DATA, profile: { ...EMPTY_DATA.profile } };
    return cache;
  }
}

export function getDataRecoveryState(): DataRecoveryState {
  return recoveryState;
}

export async function listBackups(): Promise<BackupInfo[]> {
  const backups: BackupInfo[] = [];
  for (let slot = 1; slot <= BACKUP_COUNT; slot += 1) {
    const path = backupPath(slot);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) backups.push({ slot, path, modifiedAt: info.modificationTime ?? 0 });
  }
  return backups;
}

export async function restoreBackup(slot: number): Promise<void> {
  if (slot < 1 || slot > BACKUP_COUNT) throw new Error("备份编号无效");
  const content = await readFile(backupPath(slot));
  if (!content) throw new Error("备份不存在");
  cache = normalizeWarehouseData(JSON.parse(content));
  recoveryState = { hasCorruptData: false, message: null };
  await flushData();
}

export function getCachedData(): WarehouseData | null {
  return cache;
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

/** Test and recovery helper: the next load reads the on-disk file again. */
export function resetCache(): void {
  cache = null;
}
