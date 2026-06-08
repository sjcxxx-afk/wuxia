/**
 * 同步设置管理 —— 独立于同步操作逻辑的设置存储。
 */

import { Platform } from "react-native";

const isWeb = Platform.OS === "web";
const SETTINGS_KEY = "warehouse_sync_settings";

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

/**
 * 从 localStorage 加载同步设置。
 */
export function loadSyncSettings(): SyncSettings {
  try {
    if (isWeb) {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as SyncSettings;
        syncFolderPath = s.syncFolderPath || "";
        autoSyncEnabled = s.autoSyncEnabled || false;
        syncMode = s.syncMode || "every_change";
        return s;
      }
    }
  } catch { /* ignore */ }
  return { syncFolderPath: "", autoSyncEnabled: false, syncMode: "every_change" };
}

/**
 * 保存同步设置到 localStorage。
 */
export function saveSyncSettings(s: SyncSettings): void {
  syncFolderPath = s.syncFolderPath;
  autoSyncEnabled = s.autoSyncEnabled;
  syncMode = s.syncMode;
  try {
    if (isWeb) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    }
  } catch { /* ignore */ }
}
