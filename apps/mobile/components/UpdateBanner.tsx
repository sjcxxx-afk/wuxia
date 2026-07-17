import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface UpdateBannerProps {
  /** 是否显示横幅 */
  visible: boolean;
  /** 是否有可下载的新版本 */
  updateAvailable: boolean;
  /** 是否正在下载更新 */
  isDownloading: boolean;
  /** 更新是否已下载完毕，等待用户重启 */
  isUpdatePending: boolean;
  /** 下载进度 0~1 */
  downloadProgress?: number;
  /** 下载更新 */
  onDownloadUpdate: () => void;
  /** 应用更新（重启） */
  onApplyUpdate: () => void;
  /** 稍后处理 */
  onDismiss: () => void;
}

/**
 * 热更新提示横幅（用户自主选择）
 *
 * - 发现新版本：下载 / 稍后
 * - 下载中：进度提示
 * - 下载完成：立即重启 / 稍后
 */
export default function UpdateBanner({
  visible,
  updateAvailable,
  isDownloading,
  isUpdatePending,
  downloadProgress,
  onDownloadUpdate,
  onApplyUpdate,
  onDismiss,
}: UpdateBannerProps) {
  if (!visible) return null;

  if (isUpdatePending) {
    return (
      <View style={[styles.banner, styles.bannerReady]}>
        <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
        <Text style={styles.text}>新版本已下载，重启后生效</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={onApplyUpdate}>
          <Text style={styles.actionBtnText}>立即重启</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
          <Text style={styles.dismissBtnText}>稍后</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isDownloading) {
    const pct =
      downloadProgress != null ? Math.round(downloadProgress * 100) : null;
    return (
      <View style={[styles.banner, styles.bannerDownloading]}>
        <ActivityIndicator size="small" color="#FFFFFF" />
        <Text style={styles.text}>
          {pct != null ? `正在下载更新 ${pct}%` : "正在下载更新..."}
        </Text>
      </View>
    );
  }

  if (updateAvailable) {
    return (
      <View style={[styles.banner, styles.bannerAvailable]}>
        <Ionicons name="cloud-download-outline" size={18} color="#FFFFFF" />
        <Text style={styles.text}>发现新版本</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={onDownloadUpdate}>
          <Text style={styles.actionBtnText}>下载更新</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
          <Text style={styles.dismissBtnText}>稍后</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  bannerAvailable: {
    backgroundColor: "#4F46E5",
  },
  bannerReady: {
    backgroundColor: "#059669",
  },
  bannerDownloading: {
    backgroundColor: "#4F46E5",
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  actionBtn: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  dismissBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  dismissBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
  },
});
