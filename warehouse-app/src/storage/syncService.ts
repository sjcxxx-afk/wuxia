import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { loadData, updateData, resetCache, nowISO, WarehouseData } from "./jsonStore";
import { isAutoSyncOn, getSyncFolderPath, getSyncMode } from "./syncSettings";

const isWeb = Platform.OS === "web";
let lastAutoExport = 0;

// Trigger auto export after data change
export async function triggerAutoExport(): Promise<void> {
  if (!isAutoSyncOn() || !getSyncFolderPath() || isWeb) return;

  const mode = getSyncMode();
  if (mode === "every_5min") {
    const now = Date.now();
    if (now - lastAutoExport < 5 * 60 * 1000) return;
    lastAutoExport = now;
  }
  if (mode === "every_30min") {
    const now = Date.now();
    if (now - lastAutoExport < 30 * 60 * 1000) return;
    lastAutoExport = now;
  }

  await doAutoExport();
}

// ---- auto sync: check if remote is newer ----
export async function checkAutoImport(): Promise<{
  hasUpdate: boolean;
  remoteTime: string | null;
  localTime: string | null;
}> {
  const folderPath = getSyncFolderPath();
  if (!folderPath || isWeb) {
    return { hasUpdate: false, remoteTime: null, localTime: null };
  }
  try {
    const remotePath = folderPath + "/warehouse-data.json";
    const info = await FileSystem.getInfoAsync(remotePath);
    if (!info.exists) {
      return { hasUpdate: false, remoteTime: null, localTime: null };
    }
    const remoteContent = await FileSystem.readAsStringAsync(remotePath);
    const remoteData = JSON.parse(remoteContent) as WarehouseData;
    const localData = await loadData();
    if (new Date(remoteData.lastModified) > new Date(localData.lastModified)) {
      return {
        hasUpdate: true,
        remoteTime: remoteData.lastModified,
        localTime: localData.lastModified,
      };
    }
    return {
      hasUpdate: false,
      remoteTime: remoteData.lastModified,
      localTime: localData.lastModified,
    };
  } catch {
    return { hasUpdate: false, remoteTime: null, localTime: null };
  }
}

export async function doAutoImport(): Promise<void> {
  const folderPath = getSyncFolderPath();
  if (!folderPath || isWeb) return;
  const remotePath = folderPath + "/warehouse-data.json";
  const remoteContent = await FileSystem.readAsStringAsync(remotePath);
  const remoteData = JSON.parse(remoteContent) as WarehouseData;
  mergeRemoteIntoLocal(remoteData);
}

export async function doAutoExport(): Promise<void> {
  const folderPath = getSyncFolderPath();
  if (!folderPath || isWeb) return;
  const localData = await loadData();
  const remotePath = folderPath + "/warehouse-data.json";
  await FileSystem.writeAsStringAsync(remotePath, JSON.stringify(localData, null, 2));
}

// ---- manual export ----
export async function exportToPath(targetPath: string): Promise<void> {
  if (isWeb) return;
  const localData = await loadData();
  const exportPath = targetPath.endsWith(".json")
    ? targetPath
    : targetPath + "/warehouse-data.json";
  await FileSystem.writeAsStringAsync(exportPath, JSON.stringify(localData, null, 2));
}

// ---- manual import ----
export async function importFromPath(sourcePath: string): Promise<void> {
  if (isWeb) return;
  const content = await FileSystem.readAsStringAsync(sourcePath);
  const remoteData = JSON.parse(content) as WarehouseData;
  mergeRemoteIntoLocal(remoteData);
}

// ---- merge logic ----
export function mergeRemoteIntoLocal(remoteData: WarehouseData): void {
  resetCache();
  updateData((localData) => {
    const itemMap = new Map<string, any>();
    for (const item of localData.items) itemMap.set(item.id, item);
    for (const item of remoteData.items) {
      const existing = itemMap.get(item.id);
      if (!existing || new Date(item.updatedAt) > new Date(existing.updatedAt)) {
        itemMap.set(item.id, item);
      }
    }

    const catMap = new Map<string, any>();
    for (const cat of localData.categories) catMap.set(cat.id, cat);
    for (const cat of remoteData.categories) {
      const existing = catMap.get(cat.id);
      if (!existing || new Date(cat.updatedAt) > new Date(existing.updatedAt)) {
        catMap.set(cat.id, cat);
      }
    }

    return {
      version: 1,
      lastModified: nowISO(),
      profile: remoteData.profile?.nickname
        ? remoteData.profile
        : localData.profile,
      categories: Array.from(catMap.values()),
      items: Array.from(itemMap.values()),
    };
  });
}

// ---- web: download JSON file ----
export function downloadJson(): void {
  const data = updateData((d) => d);
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "warehouse-data.json";
  a.click();
  URL.revokeObjectURL(url);
}

// ---- web: upload & merge JSON file ----
export function uploadJson(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const remoteData = JSON.parse(reader.result as string) as WarehouseData;
        mergeRemoteIntoLocal(remoteData);
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
