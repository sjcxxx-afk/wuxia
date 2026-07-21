/**
 * 同步设置管理 —— 独立于同步操作逻辑的设置存储。
 *
 * 使用 expo-file-system 将设置持久化到应用文档目录。
 */

import * as FileSystem from "expo-file-system/legacy";

const SETTINGS_FILENAME = "warehouse-sync-settings.json";

export type SyncSettings = {
  syncFolderPath: string;
  autoSyncEnabled: boolean;
  syncMode: "every_change" | "every_5min" | "every_30min";
};

let syncFolderPath: string = "";
let autoSyncEnabled: boolean = false;
let syncMode: "every_change" | "every_5min" | "every_30min" = "every_change";

export function getSyncFolderPath(): string {
  return syncFolderPath;
}

export function setSyncFolderPath(path: string): void {
  syncFolderPath = path;
}

export function isAutoSyncOn(): boolean {
  return autoSyncEnabled;
}

export function getSyncMode(): string {
  return syncMode;
}

async function readSettingsFile(): Promise<string | null> {
  try {
    const filePath = FileSystem.documentDirectory + SETTINGS_FILENAME;
    const info = await FileSystem.getInfoAsync(filePath);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(filePath);
  } catch {
    return null;
  }
}

async function writeSettingsFile(content: string): Promise<void> {
  try {
    const filePath = FileSystem.documentDirectory + SETTINGS_FILENAME;
    await FileSystem.writeAsStringAsync(filePath, content);
  } catch { /* ignore */ }
}

/**
 * 从文件系统加载同步设置。
 */
export async function loadSyncSettings(): Promise<SyncSettings> {
  try {
    const raw = await readSettingsFile();
    if (raw) {
      const s = JSON.parse(raw) as Partial<SyncSettings>;
      syncFolderPath = s.syncFolderPath || "";
      autoSyncEnabled = s.autoSyncEnabled === true;
      syncMode = s.syncMode || "every_change";
    }
  } catch { /* Retain safe defaults for invalid or unavailable settings. */ }
  return { syncFolderPath, autoSyncEnabled, syncMode };
}

/**
 * 保存同步设置到文件系统。
 */
export function saveSyncSettings(s: SyncSettings): void {
  syncFolderPath = s.syncFolderPath;
  autoSyncEnabled = s.autoSyncEnabled;
  syncMode = s.syncMode;
  writeSettingsFile(JSON.stringify(s)).catch(() => {});
}
