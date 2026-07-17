import * as FileSystem from "expo-file-system/legacy";
import { StorageAccessFramework } from "expo-file-system/legacy";
import { loadData, updateData, resetCache, nowISO, WarehouseData } from "./jsonStore";
import { isAutoSyncOn, getSyncFolderPath, getSyncMode } from "./syncSettings";

/** Cloud-sync file uses .txt so Quark VIP and similar services accept it. Content remains JSON. */
const SYNC_FILENAME = "warehouse-data.txt";
const LEGACY_SYNC_FILENAME = "warehouse-data.json";

let lastAutoExport = 0;

function isSafDirectoryUri(folderPath: string): boolean {
  return folderPath.startsWith("content://");
}

function matchesSafFileName(uri: string, fileName: string): boolean {
  const decoded = decodeURIComponent(uri).toLowerCase();
  return decoded.includes(fileName.toLowerCase());
}

async function findSafFile(directoryUri: string, fileNames: string[]): Promise<string | null> {
  const files = await StorageAccessFramework.readDirectoryAsync(directoryUri);
  for (const fileName of fileNames) {
    const found = files.find((uri: string) => matchesSafFileName(uri, fileName));
    if (found) return found;
  }
  return null;
}

async function writeSafSyncFile(directoryUri: string, content: string): Promise<void> {
  const existing = await findSafFile(directoryUri, [SYNC_FILENAME]);
  const fileUri =
    existing ??
    (await StorageAccessFramework.createFileAsync(directoryUri, "warehouse-data", "text/plain"));
  await FileSystem.writeAsStringAsync(fileUri, content);

  const legacy = await findSafFile(directoryUri, [LEGACY_SYNC_FILENAME]);
  if (legacy) {
    await FileSystem.deleteAsync(legacy, { idempotent: true });
  }
}

async function removeSafLegacySyncFile(directoryUri: string): Promise<void> {
  try {
    const legacy = await findSafFile(directoryUri, [LEGACY_SYNC_FILENAME]);
    if (legacy) {
      await FileSystem.deleteAsync(legacy, { idempotent: true });
    }
  } catch {
    // ignore cleanup failures
  }
}

function syncFilePath(folderPath: string): string {
  return folderPath + "/" + SYNC_FILENAME;
}

function legacySyncFilePath(folderPath: string): string {
  return folderPath + "/" + LEGACY_SYNC_FILENAME;
}

/** Prefer .txt; fall back to legacy .json for existing sync folders. */
async function resolveRemoteSyncPath(folderPath: string): Promise<string | null> {
  if (isSafDirectoryUri(folderPath)) {
    const primary = await findSafFile(folderPath, [SYNC_FILENAME]);
    if (primary) return primary;
    return findSafFile(folderPath, [LEGACY_SYNC_FILENAME]);
  }

  const primary = syncFilePath(folderPath);
  const primaryInfo = await FileSystem.getInfoAsync(primary);
  if (primaryInfo.exists) return primary;

  const legacy = legacySyncFilePath(folderPath);
  const legacyInfo = await FileSystem.getInfoAsync(legacy);
  if (legacyInfo.exists) return legacy;

  return null;
}

async function removeLegacySyncFile(folderPath: string): Promise<void> {
  try {
    if (isSafDirectoryUri(folderPath)) {
      await removeSafLegacySyncFile(folderPath);
      return;
    }

    const legacy = legacySyncFilePath(folderPath);
    const info = await FileSystem.getInfoAsync(legacy);
    if (info.exists) {
      await FileSystem.deleteAsync(legacy, { idempotent: true });
    }
  } catch {
    // ignore cleanup failures
  }
}

// Trigger auto export after data change
export async function triggerAutoExport(): Promise<void> {
  if (!isAutoSyncOn() || !getSyncFolderPath()) return;

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
  if (!folderPath) {
    return { hasUpdate: false, remoteTime: null, localTime: null };
  }
  try {
    const remotePath = await resolveRemoteSyncPath(folderPath);
    if (!remotePath) {
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
  if (!folderPath) return;
  const remotePath = await resolveRemoteSyncPath(folderPath);
  if (!remotePath) {
    throw new Error("同步文件夹中未找到 warehouse-data.txt");
  }
  const remoteContent = await FileSystem.readAsStringAsync(remotePath);
  const remoteData = JSON.parse(remoteContent) as WarehouseData;
  mergeRemoteIntoLocal(remoteData);
}

export async function doAutoExport(): Promise<void> {
  const folderPath = getSyncFolderPath();
  if (!folderPath) return;
  const localData = await loadData();
  const content = JSON.stringify(localData, null, 2);

  if (isSafDirectoryUri(folderPath)) {
    await writeSafSyncFile(folderPath, content);
    return;
  }

  await FileSystem.writeAsStringAsync(
    syncFilePath(folderPath),
    content
  );
  await removeLegacySyncFile(folderPath);
}

// ---- manual export ----
export async function exportToPath(targetPath: string): Promise<void> {
  const localData = await loadData();
  const exportPath =
    targetPath.endsWith(".txt") || targetPath.endsWith(".json")
      ? targetPath
      : targetPath + "/" + SYNC_FILENAME;
  await FileSystem.writeAsStringAsync(exportPath, JSON.stringify(localData, null, 2));
}

// ---- manual import ----
export async function importFromPath(sourcePath: string): Promise<void> {
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
