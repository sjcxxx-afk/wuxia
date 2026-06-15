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
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  loadSyncSettings,
  saveSyncSettings,
  type SyncSettings,
} from "../lib/storage/syncSettings";
import {
  checkAutoImport,
  doAutoImport,
  doAutoExport,
} from "../lib/storage/syncService";

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

  useEffect(() => {
    const s = loadSyncSettings();
    setSyncPath(s.syncFolderPath);
    setAutoSync(s.autoSyncEnabled);
    setSyncMode(s.syncMode);
  }, []);

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
              await doAutoImport();
              Alert.alert("导入成功", "数据已合并");
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

  const handleSetPath = () => {
    saveSyncSettings({ syncFolderPath: pathInput, autoSyncEnabled: autoSync, syncMode });
    setSyncPath(pathInput);
    setPathModalVisible(false);
  };

  return (
    <View style={styles.syncCard}>
      <Text style={styles.syncHint}>
        将 warehouse-data.json 放在云盘同步文件夹，实现多设备数据流转
      </Text>

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
        安卓示例: /storage/emulated/0/夸克/同步/
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
          <Text style={styles.syncBtnText}>导出 JSON</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.syncBtn, styles.importBtn]}
          onPress={handleImport}
        >
          <Ionicons name="cloud-download-outline" size={16} color="#FFFFFF" />
          <Text style={styles.syncBtnText}>{importing ? "导入中..." : "导入 JSON"}</Text>
        </TouchableOpacity>
      </View>

      {/* Path Modal */}
      <Modal
        visible={pathModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPathModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>设置同步文件夹</Text>
            <Text style={styles.pathHint}>
              请输入云盘同步文件夹的完整路径
            </Text>
            <Text style={styles.pathExample}>
              例: /storage/emulated/0/夸克/同步
            </Text>
            <TextInput
              style={styles.pathInput}
              value={pathInput}
              onChangeText={setPathInput}
              placeholder="/storage/emulated/0/..."
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
  syncHint: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 4 },
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
  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 32 },
  modalCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24, width: "100%", maxWidth: 340 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#111827", textAlign: "center", marginBottom: 16 },
  pathHint: { fontSize: 13, color: "#6B7280", marginBottom: 4, textAlign: "center" },
  pathExample: { fontSize: 12, color: "#9CA3AF", marginBottom: 16, textAlign: "center", fontStyle: "italic" },
  pathInput: { height: 44, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 14, fontSize: 14, color: "#111827", backgroundColor: "#F9FAFB", marginBottom: 12 },
  pathModalBtns: { flexDirection: "row", gap: 10 },
  pathCancelBtn: { flex: 1, height: 42, borderRadius: 10, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  pathCancelText: { fontSize: 15, color: "#6B7280", fontWeight: "600" },
  pathConfirmBtn: { flex: 1, height: 42, borderRadius: 10, backgroundColor: "#4F46E5", justifyContent: "center", alignItems: "center" },
  pathConfirmText: { fontSize: 15, color: "#FFFFFF", fontWeight: "600" },
});
