import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  TextInput,
  Modal,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StorageAccessFramework } from "expo-file-system/legacy";
import { loadSyncSettings, saveSyncSettings } from "../lib/storage/syncSettings";
import {
  checkAutoImport,
  doAutoImport,
  doAutoExport,
} from "../lib/storage/syncService";
import { getDataRecoveryState, listBackups, restoreBackup, type BackupInfo } from "../lib/storage/jsonStore";

type SyncMode = "every_change" | "every_5min" | "every_30min";

const SYNC_MODES: { key: SyncMode; label: string }[] = [
  { key: "every_change", label: "每次修改后" },
  { key: "every_5min", label: "每 5 分钟" },
  { key: "every_30min", label: "每 30 分钟" },
];

export default function SyncSettingsCard() {
  const [syncPath, setSyncPath] = useState("");
  const [autoSync, setAutoSync] = useState(false);
  const [syncMode, setSyncMode] = useState<SyncMode>("every_change");
  const [syncStatus, setSyncStatus] = useState("");
  const [pathModalVisible, setPathModalVisible] = useState(false);
  const [pathInput, setPathInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  const refreshBackups = useCallback(async () => {
    setBackups(await listBackups());
    const recovery = getDataRecoveryState();
    setRecoveryMessage(recovery.hasCorruptData ? recovery.message : null);
  }, []);

  useEffect(() => {
    void (async () => {
      const s = await loadSyncSettings();
      setSyncPath(s.syncFolderPath);
      setAutoSync(s.autoSyncEnabled);
      setSyncMode(s.syncMode);
      await refreshBackups();
    })();
  }, [refreshBackups]);

  const updateAutoSync = (enabled: boolean) => {
    setAutoSync(enabled);
    saveSyncSettings({ syncFolderPath: syncPath, autoSyncEnabled: enabled, syncMode });
  };
  const updateSyncMode = (mode: SyncMode) => {
    setSyncMode(mode);
    saveSyncSettings({ syncFolderPath: syncPath, autoSyncEnabled: autoSync, syncMode: mode });
  };

  const checkSync = useCallback(async () => {
    if (syncPath) {
      const result = await checkAutoImport();
      setSyncStatus(result.hasUpdate ? "云端有更新" : "已同步");
    } else {
      setSyncStatus("");
    }
  }, [syncPath]);

  useFocusEffect(
    useCallback(() => {
      checkSync();
    }, [checkSync])
  );

  const handleExport = async () => {
    if (!syncPath) {
      Alert.alert("提示", "请先设置同步文件夹路径");
      return;
    }
    try {
      await doAutoExport();
      Alert.alert("导出成功", "数据已导出到同步文件夹");
      checkSync();
    } catch (e: any) {
      Alert.alert("导出失败", e.message);
    }
  };

  const handleImport = async () => {
    if (!syncPath) {
      Alert.alert("提示", "请先设置同步文件夹路径");
      return;
    }

    const result = await checkAutoImport();
    if (result.hasUpdate) {
      Alert.alert("发现更新", "云端数据较新，要合并到本地吗？", [
        { text: "取消", style: "cancel" },
        {
          text: "合并",
          onPress: async () => {
            setImporting(true);
            try {
              const merged = await doAutoImport();
              Alert.alert("导入成功", `新增 ${merged.added}、更新 ${merged.updated}、删除 ${merged.deleted}、跳过 ${merged.skipped}`);
              await refreshBackups();
              checkSync();
            } catch (e: any) {
              Alert.alert("导入失败", e.message);
            } finally {
              setImporting(false);
            }
          },
        },
      ]);
    } else if (result.remoteTime) {
      Alert.alert("提示", "本地数据已是最新");
    }
  };

  const handleRestoreBackup = (backup: BackupInfo) => {
    Alert.alert("恢复本地备份", "将以该备份覆盖当前本地数据，并保留当前数据为新的备份。", [
      { text: "取消", style: "cancel" },
      {
        text: "恢复",
        style: "destructive",
        onPress: async () => {
          try {
            await restoreBackup(backup.slot);
            await refreshBackups();
            Alert.alert("恢复成功", "已恢复本地备份，请按需重新导出同步文件。");
          } catch (e: any) {
            Alert.alert("恢复失败", e?.message ?? "无法恢复备份");
          }
        },
      },
    ]);
  };

  const handleSetPath = () => {
    if (!pathInput.trim()) {
      Alert.alert("提示", "请先输入或选择同步文件夹");
      return;
    }
    saveSyncSettings({ syncFolderPath: pathInput, autoSyncEnabled: autoSync, syncMode });
    setSyncPath(pathInput);
    setPathModalVisible(false);
  };

  const handlePickFolder = async () => {
    if (Platform.OS !== "android") {
      Alert.alert("提示", "当前仅 Android 支持系统文件夹选择，iOS 请手动输入路径。");
      return;
    }
    try {
      const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permission.granted || !permission.directoryUri) {
        return;
      }
      setPathInput(permission.directoryUri);
      saveSyncSettings({
        syncFolderPath: permission.directoryUri,
        autoSyncEnabled: autoSync,
        syncMode,
      });
      setSyncPath(permission.directoryUri);
      setPathModalVisible(false);
      Alert.alert("设置成功", "已选择同步文件夹");
    } catch (e: any) {
      Alert.alert("选择失败", e?.message ?? "无法选择文件夹");
    }
  };

  return (
    <View style={styles.syncCard}>
      {/* Sync folder path */}
      <TouchableOpacity
        style={styles.settingRow}
        onPress={() => {
          setPathInput(syncPath);
          setPathModalVisible(true);
        }}
      >
        <Text style={styles.settingLabel}>同步文件夹</Text>
        <Text style={styles.settingValue} numberOfLines={1}>
          {syncPath || "点击设置"}
        </Text>
      </TouchableOpacity>
      <Text style={styles.settingHint}>
        Android 推荐使用“选择手机文件夹”；也支持手动输入路径
      </Text>

      {/* Auto sync toggle */}
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>自动同步</Text>
        <Switch
          value={autoSync}
          onValueChange={updateAutoSync}
          trackColor={{ false: "#E5E7EB", true: "#C7D2FE" }}
          thumbColor={autoSync ? "#4F46E5" : "#9CA3AF"}
        />
      </View>
      {autoSync && <View style={styles.divider} />}

      {/* Sync mode */}
      {autoSync && (
        <View style={styles.modeRow}>
          {SYNC_MODES.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.modeBtn, syncMode === m.key && styles.modeBtnActive]}
              onPress={() => updateSyncMode(m.key)}
            >
              <Text
                style={[styles.modeBtnText, syncMode === m.key && styles.modeBtnTextActive]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Status */}
      {syncStatus ? (
        <Text style={[styles.syncStatusText, syncStatus === "云端有更新" && styles.syncUpdate]}>
          {syncStatus}
        </Text>
      ) : null}

      {/* Actions */}
      <View style={styles.syncActions}>
        <TouchableOpacity style={styles.syncBtn} onPress={handleExport}>
          <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
          <Text style={styles.syncBtnText}>导出数据</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.syncBtn, styles.importBtn]}
          onPress={handleImport}
        >
          <Ionicons name="cloud-download-outline" size={16} color="#FFFFFF" />
          <Text style={styles.syncBtnText}>{importing ? "导入中..." : "导入数据"}</Text>
        </TouchableOpacity>
      </View>

      {(recoveryMessage || backups.length > 0) && <View style={styles.backupSection}>
        {recoveryMessage ? <Text style={styles.recoveryText}>检测到本地数据异常：{recoveryMessage}。可恢复最近备份。</Text> : null}
        {backups.map((backup) => (
          <TouchableOpacity key={backup.slot} style={styles.backupRow} onPress={() => handleRestoreBackup(backup)}>
            <Text style={styles.backupText}>恢复备份 {backup.slot}（{new Date(backup.modifiedAt).toLocaleString()}）</Text>
            <Ionicons name="refresh-outline" size={16} color="#4F46E5" />
          </TouchableOpacity>
        ))}
      </View>}

      {/* Path Modal */}
      <Modal
        visible={pathModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPathModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.keyboardAvoiding}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>设置同步文件夹</Text>
              <Text style={styles.pathHint}>
                可直接选择手机文件夹（推荐），也可手动输入路径/URI
              </Text>
              <TouchableOpacity style={styles.pickFolderBtn} onPress={handlePickFolder}>
                <Ionicons name="folder-open-outline" size={16} color="#4F46E5" />
                <Text style={styles.pickFolderText}>选择手机文件夹（推荐）</Text>
              </TouchableOpacity>
              <Text style={styles.pathExample}>
                例如：/storage/emulated/0/夸克/同步 或 content://...
              </Text>
              <TextInput
                style={styles.pathInput}
                value={pathInput}
                onChangeText={setPathInput}
                placeholder="/storage/emulated/0/... 或 content://..."
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
              />
              <View style={styles.pathModalBtns}>
                <TouchableOpacity
                  style={styles.pathCancelBtn}
                  onPress={() => setPathModalVisible(false)}
                >
                  <Text style={styles.pathCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pathConfirmBtn} onPress={handleSetPath}>
                  <Text style={styles.pathConfirmText}>确认</Text>
                </TouchableOpacity>
              </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  syncCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    gap: 12,
  },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  settingLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  settingValue: { fontSize: 13, color: "#4F46E5", maxWidth: 180 },
  settingHint: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#F3F4F6" },
  modeRow: { flexDirection: "row", gap: 8 },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: "#F3F4F6", alignItems: "center" },
  modeBtnActive: { backgroundColor: "#EEF2FF" },
  modeBtnText: { fontSize: 13, color: "#6B7280" },
  modeBtnTextActive: { color: "#4F46E5", fontWeight: "600" },
  syncStatusText: { fontSize: 13, color: "#059669", fontWeight: "500" },
  syncUpdate: { color: "#D97706" },
  syncActions: { flexDirection: "row", gap: 10 },
  syncBtn: { flex: 1, flexDirection: "row", height: 40, backgroundColor: "#4F46E5", borderRadius: 10, justifyContent: "center", alignItems: "center", gap: 6 },
  importBtn: { backgroundColor: "#059669" },
  syncBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  backupSection: { gap: 8, borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 12 },
  recoveryText: { fontSize: 12, color: "#B45309", lineHeight: 18 },
  backupRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  backupText: { fontSize: 12, color: "#4F46E5", flex: 1 },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 32 },
  keyboardAvoiding: { width: "100%", maxHeight: "90%" },
  modalScrollContent: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  modalCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24, width: "100%", maxWidth: 340 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#111827", textAlign: "center", marginBottom: 16 },
  pathHint: { fontSize: 13, color: "#6B7280", marginBottom: 4, textAlign: "center" },
  pickFolderBtn: {
    marginTop: 6,
    marginBottom: 10,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    backgroundColor: "#EEF2FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pickFolderText: { fontSize: 13, color: "#4338CA", fontWeight: "600" },
  pathExample: { fontSize: 12, color: "#9CA3AF", marginBottom: 16, textAlign: "center", fontStyle: "italic" },
  pathInput: { height: 44, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 14, fontSize: 14, color: "#111827", backgroundColor: "#F9FAFB", marginBottom: 12 },
  pathModalBtns: { flexDirection: "row", gap: 10 },
  pathCancelBtn: { flex: 1, height: 42, borderRadius: 10, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  pathCancelText: { fontSize: 15, color: "#6B7280", fontWeight: "600" },
  pathConfirmBtn: { flex: 1, height: 42, borderRadius: 10, backgroundColor: "#4F46E5", justifyContent: "center", alignItems: "center" },
  pathConfirmText: { fontSize: 15, color: "#FFFFFF", fontWeight: "600" },
});
