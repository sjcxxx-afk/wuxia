import * as FileSystem from "expo-file-system/legacy";
import { StorageAccessFramework } from "expo-file-system/legacy";
import {
  DeletedRecord,
  ItemData,
  CategoryData,
  WarehouseData,
  flushData,
  loadData,
  normalizeWarehouseData,
  nowISO,
  updateData,
} from "./jsonStore";
import { isAutoSyncOn, getSyncFolderPath, getSyncMode } from "./syncSettings";

const SYNC_FILENAME = "warehouse-data.txt";
const LEGACY_SYNC_FILENAME = "warehouse-data.json";
let lastAutoExport = 0;

export interface MergeResult {
  added: number;
  updated: number;
  deleted: number;
  skipped: number;
}

function isSafDirectoryUri(folderPath: string): boolean {
  return folderPath.startsWith("content://");
}

function matchesSafFileName(uri: string, fileName: string): boolean {
  return decodeURIComponent(uri).toLowerCase().includes(fileName.toLowerCase());
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
  const fileUri = existing ?? await StorageAccessFramework.createFileAsync(directoryUri, "warehouse-data", "text/plain");
  await FileSystem.writeAsStringAsync(fileUri, content);
  const legacy = await findSafFile(directoryUri, [LEGACY_SYNC_FILENAME]);
  if (legacy) await FileSystem.deleteAsync(legacy, { idempotent: true });
}

function syncFilePath(folderPath: string): string {
  return folderPath + "/" + SYNC_FILENAME;
}

function legacySyncFilePath(folderPath: string): string {
  return folderPath + "/" + LEGACY_SYNC_FILENAME;
}

async function resolveRemoteSyncPath(folderPath: string): Promise<string | null> {
  if (isSafDirectoryUri(folderPath)) {
    return (await findSafFile(folderPath, [SYNC_FILENAME])) ?? findSafFile(folderPath, [LEGACY_SYNC_FILENAME]);
  }
  const primary = syncFilePath(folderPath);
  if ((await FileSystem.getInfoAsync(primary)).exists) return primary;
  const legacy = legacySyncFilePath(folderPath);
  return (await FileSystem.getInfoAsync(legacy)).exists ? legacy : null;
}

async function removeLegacySyncFile(folderPath: string): Promise<void> {
  try {
    if (isSafDirectoryUri(folderPath)) {
      const legacy = await findSafFile(folderPath, [LEGACY_SYNC_FILENAME]);
      if (legacy) await FileSystem.deleteAsync(legacy, { idempotent: true });
      return;
    }
    await FileSystem.deleteAsync(legacySyncFilePath(folderPath), { idempotent: true });
  } catch {
    // The valid .txt export remains usable when legacy cleanup fails.
  }
}

function maxTombstones(...sources: DeletedRecord[][]): Map<string, DeletedRecord> {
  const result = new Map<string, DeletedRecord>();
  for (const source of sources) {
    for (const tombstone of source) {
      const current = result.get(tombstone.id);
      if (!current || new Date(tombstone.deletedAt) > new Date(current.deletedAt)) result.set(tombstone.id, tombstone);
    }
  }
  return result;
}

function latestById<T extends { id: string; updatedAt: string }>(...sources: T[][]): Map<string, T> {
  const result = new Map<string, T>();
  for (const source of sources) {
    for (const record of source) {
      const current = result.get(record.id);
      if (!current || new Date(record.updatedAt) > new Date(current.updatedAt)) result.set(record.id, record);
    }
  }
  return result;
}

function mergeRecords<T extends { id: string; updatedAt: string }>(
  localRecords: T[], remoteRecords: T[], localTombstones: DeletedRecord[], remoteTombstones: DeletedRecord[]
): { records: T[]; tombstones: DeletedRecord[] } {
  const records = latestById(localRecords, remoteRecords);
  const tombstones = maxTombstones(localTombstones, remoteTombstones);
  const merged: T[] = [];
  for (const [id, record] of records) {
    const tombstone = tombstones.get(id);
    if (!tombstone || new Date(record.updatedAt) > new Date(tombstone.deletedAt)) {
      merged.push(record);
    }
  }
  return { records: merged, tombstones: [...tombstones.values()] };
}

function countMergeChanges<T extends { id: string; updatedAt: string }>(local: T[], merged: T[]): MergeResult {
  const localById = new Map(local.map((record) => [record.id, record]));
  const mergedById = new Map(merged.map((record) => [record.id, record]));
  let added = 0;
  let updated = 0;
  let deleted = 0;
  for (const [id, record] of mergedById) {
    const localRecord = localById.get(id);
    if (!localRecord) added += 1;
    else if (localRecord.updatedAt !== record.updatedAt) updated += 1;
  }
  for (const id of localById.keys()) if (!mergedById.has(id)) deleted += 1;
  return { added, updated, deleted, skipped: 0 };
}

function addResults(a: MergeResult, b: MergeResult): MergeResult {
  return { added: a.added + b.added, updated: a.updated + b.updated, deleted: a.deleted + b.deleted, skipped: a.skipped + b.skipped };
}

export async function triggerAutoExport(): Promise<void> {
  if (!isAutoSyncOn() || !getSyncFolderPath()) return;
  const mode = getSyncMode();
  const interval = mode === "every_5min" ? 5 * 60_000 : mode === "every_30min" ? 30 * 60_000 : 0;
  if (interval && Date.now() - lastAutoExport < interval) return;
  lastAutoExport = Date.now();
  await doAutoExport();
}

export async function checkAutoImport(): Promise<{ hasUpdate: boolean; remoteTime: string | null; localTime: string | null }> {
  const folderPath = getSyncFolderPath();
  if (!folderPath) return { hasUpdate: false, remoteTime: null, localTime: null };
  try {
    const remotePath = await resolveRemoteSyncPath(folderPath);
    if (!remotePath) return { hasUpdate: false, remoteTime: null, localTime: null };
    const remote = normalizeWarehouseData(JSON.parse(await FileSystem.readAsStringAsync(remotePath)));
    const local = await loadData();
    return { hasUpdate: new Date(remote.lastModified) > new Date(local.lastModified), remoteTime: remote.lastModified, localTime: local.lastModified };
  } catch {
    return { hasUpdate: false, remoteTime: null, localTime: null };
  }
}

export async function doAutoImport(): Promise<MergeResult> {
  const folderPath = getSyncFolderPath();
  if (!folderPath) throw new Error("请先设置同步文件夹");
  const remotePath = await resolveRemoteSyncPath(folderPath);
  if (!remotePath) throw new Error("同步文件夹中未找到 warehouse-data.txt");
  return mergeRemoteIntoLocal(normalizeWarehouseData(JSON.parse(await FileSystem.readAsStringAsync(remotePath))));
}

export async function doAutoExport(): Promise<void> {
  const folderPath = getSyncFolderPath();
  if (!folderPath) return;
  await flushData();
  const content = JSON.stringify(await loadData(), null, 2);
  if (isSafDirectoryUri(folderPath)) await writeSafSyncFile(folderPath, content);
  else {
    await FileSystem.writeAsStringAsync(syncFilePath(folderPath), content);
    await removeLegacySyncFile(folderPath);
  }
}

export async function exportToPath(targetPath: string): Promise<void> {
  await flushData();
  const path = targetPath.endsWith(".txt") || targetPath.endsWith(".json") ? targetPath : targetPath + "/" + SYNC_FILENAME;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(await loadData(), null, 2));
}

export async function importFromPath(sourcePath: string): Promise<MergeResult> {
  return mergeRemoteIntoLocal(normalizeWarehouseData(JSON.parse(await FileSystem.readAsStringAsync(sourcePath))));
}

export async function mergeRemoteIntoLocal(remote: WarehouseData): Promise<MergeResult> {
  const local = await loadData();
  const itemMerge = mergeRecords<ItemData>(local.items, remote.items, local.deletedItems, remote.deletedItems);
  const categoryMerge = mergeRecords<CategoryData>(local.categories, remote.categories, local.deletedCategories, remote.deletedCategories);
  const result = addResults(countMergeChanges(local.items, itemMerge.records), countMergeChanges(local.categories, categoryMerge.records));
  const remoteIsNewer = new Date(remote.lastModified) > new Date(local.lastModified);

  updateData(() => ({
    version: 2,
    lastModified: nowISO(),
    profile: remoteIsNewer ? remote.profile : local.profile,
    categories: categoryMerge.records,
    items: itemMerge.records,
    deletedItems: itemMerge.tombstones,
    deletedCategories: categoryMerge.tombstones,
  }));
  await flushData();
  return result;
}
