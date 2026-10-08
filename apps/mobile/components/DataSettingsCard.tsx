import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  exportBackup,
  selectBackup,
  type BackupProgress,
  type BackupSelection,
} from "../lib/storage/backupService";
import { getDataRecoveryState } from "../lib/storage/jsonStore";
import { colors } from "../lib/theme";

type Props = {
  /** 导入完成后回调，供上层刷新匣主资料与统计。 */
  onImported?: () => void;
};

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DataSettingsCard({ onImported }: Props) {
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [progress, setProgress] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  const refreshRecovery = useCallback(() => {
    const recovery = getDataRecoveryState();
    setRecoveryMessage(recovery.hasCorruptData ? recovery.message : null);
  }, []);

  useEffect(() => {
    refreshRecovery();
  }, [refreshRecovery]);

  const handleExport = async () => {
    if (busy) return;
    setBusy("export");
    setProgress("准备导出…");
    try {
      const summary = await exportBackup(({ done, total }: BackupProgress) =>
        setProgress(total > 0 ? `正在导出图片 ${done}/${total}` : "正在导出…")
      );
      if (!summary) {
        setProgress("");
        return;
      }
      const missing = summary.missingImages > 0 ? `\n有 ${summary.missingImages} 张图片文件已丢失，未能导出` : "";
      Alert.alert(
        "导出成功",
        `${summary.dirName}\n匣物 ${summary.itemCount} 件、分类 ${summary.categoryCount} 个、图片 ${summary.imageCount} 张（${formatBytes(summary.bytes)}）${missing}`
      );
    } catch (e: any) {
      Alert.alert("导出失败", e?.message ?? "无法写入所选文件夹");
    } finally {
      setBusy(null);
      setProgress("");
    }
  };

  const runImport = async (selection: BackupSelection) => {
    setBusy("import");
    setProgress("准备导入…");
    try {
      const summary = await selection.apply(({ done, total }: BackupProgress) =>
        setProgress(total > 0 ? `正在导入图片 ${done}/${total}` : "正在导入…")
      );
      const missing = summary.missingImages > 0 ? `\n${summary.missingImages} 张图片在备份包中缺失，未导入` : "";
      const pruned = summary.prunedImages > 0 ? `\n已清理 ${summary.prunedImages} 张无引用图片` : "";
      refreshRecovery();
      onImported?.();
      Alert.alert(
        "导入完成",
        `匣物 ${summary.itemCount} 件、分类 ${summary.categoryCount} 个、图片 ${summary.imageCount} 张${missing}${pruned}`
      );
    } catch (e: any) {
      Alert.alert("导入失败", e?.message ?? "无法导入备份包");
    } finally {
      setBusy(null);
      setProgress("");
    }
  };

  const handleImport = async () => {
    if (busy) return;
    setBusy("import");
    setProgress("正在读取备份包…");
    try {
      const selection = await selectBackup();
      if (!selection) return;
      const missing =
        selection.missingImages > 0 ? `\n⚠ 其中有 ${selection.missingImages} 张图片缺失` : "";
      Alert.alert(
        "覆盖导入？",
        `备份包：${selection.dirName}\n备份时间：${new Date(selection.backedUpAt).toLocaleString()}\n匣物 ${selection.itemCount} 件、分类 ${selection.categoryCount} 个、图片 ${selection.imageCount} 张${missing}\n\n导入会覆盖本机现有全部数据，且无法撤销。`,
        [
          { text: "取消", style: "cancel" },
          { text: "覆盖导入", style: "destructive", onPress: () => void runImport(selection) },
        ]
      );
    } catch (e: any) {
      Alert.alert("无法读取备份", e?.message ?? "请选择正确的备份包文件夹");
    } finally {
      // 弹窗不是阻塞的：这里只负责结束「读取备份包」阶段，覆盖动作由 runImport 接管。
      setBusy(null);
      setProgress("");
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="archive-outline" size={18} color={colors.accent} />
        </View>
        <Text style={styles.title}>数据备份</Text>
      </View>

      <Text style={styles.desc}>
        导出会把全部匣物数据与图片打包成一个「物匣备份-日期时间」文件夹，可直接拷到新手机；
        导入时选择该文件夹即可整体恢复。
      </Text>

      {recoveryMessage ? (
        <Text style={styles.warningText}>检测到本地数据异常：{recoveryMessage}。可从导出备份恢复。</Text>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, busy && styles.actionBtnDisabled]}
          onPress={handleExport}
          disabled={!!busy}
        >
          {busy === "export" ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : (
            <Ionicons name="arrow-up-circle-outline" size={17} color={colors.surface} />
          )}
          <Text style={styles.actionText}>导出数据</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.importBtn, busy && styles.actionBtnDisabled]}
          onPress={handleImport}
          disabled={!!busy}
        >
          {busy === "import" ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : (
            <Ionicons name="arrow-down-circle-outline" size={17} color={colors.surface} />
          )}
          <Text style={styles.actionText}>导入数据</Text>
        </TouchableOpacity>
      </View>

      {progress ? <Text style={styles.progressText}>{progress}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceSunken,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 15, fontWeight: "600", color: colors.text },
  desc: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  warningText: { fontSize: 12, color: colors.warning, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 10, marginTop: 2 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  importBtn: { backgroundColor: colors.success },
  actionBtnDisabled: { opacity: 0.6 },
  actionText: { color: colors.surface, fontSize: 14, fontWeight: "600" },
  progressText: { fontSize: 12, color: colors.textTertiary },
});
