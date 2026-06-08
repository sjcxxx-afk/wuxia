import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

const DATA_FILENAME = "warehouse-data.json";
const STORAGE_KEY = "warehouse_data";

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
  createdAt: string;
  updatedAt: string;
}

const EMPTY_DATA: WarehouseData = {
  version: 1,
  lastModified: new Date().toISOString(),
  profile: { nickname: "", avatarUrl: null },
  categories: [],
  items: [],
};

let cache: WarehouseData | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const isWeb = Platform.OS === "web";

// ---- platform-agnostic file I/O ----
async function readDataFile(): Promise<string | null> {
  if (isWeb) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw;
    } catch {
      return null;
    }
  }
  try {
    const filePath = FileSystem.documentDirectory + DATA_FILENAME;
    const info = await FileSystem.getInfoAsync(filePath);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(filePath);
  } catch {
    return null;
  }
}

async function writeDataFile(content: string): Promise<void> {
  if (isWeb) {
    try {
      localStorage.setItem(STORAGE_KEY, content);
    } catch (e) {
      console.error("Failed to save data:", e);
    }
    return;
  }
  try {
    const filePath = FileSystem.documentDirectory + DATA_FILENAME;
    await FileSystem.writeAsStringAsync(filePath, content);
  } catch (e) {
    console.error("Failed to save data:", e);
  }
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function loadData(): Promise<WarehouseData> {
  if (cache) return cache;
  try {
    const content = await readDataFile();
    if (!content) {
      cache = { ...EMPTY_DATA };
      await flushData();
      return cache;
    }
    const parsed = JSON.parse(content) as WarehouseData;
    // backward compat: ensure new fields exist
    parsed.categories = parsed.categories.map((c) => ({
      ...c,
      customFields: c.customFields ?? [],
    }));
    parsed.items = parsed.items.map((item) => ({
      ...item,
      images: item.images ?? [],
      customValues: item.customValues ?? {},
    }));
    cache = parsed;
    return cache;
  } catch {
    cache = { ...EMPTY_DATA };
    return cache;
  }
}

export function getCachedData(): WarehouseData | null {
  return cache;
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => flushData(), 300);
}

export async function flushData(): Promise<void> {
  if (!cache) return;
  cache.lastModified = nowISO();
  await writeDataFile(JSON.stringify(cache, null, 2));
}

export function updateData(
  updater: (data: WarehouseData) => WarehouseData
): WarehouseData {
  if (!cache) throw new Error("Data not loaded. Call loadData() first.");
  cache = updater(cache);
  scheduleSave();
  return cache;
}

export function resetCache(): void {
  cache = null;
}
