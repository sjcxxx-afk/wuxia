import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface UpdateBannerProps {
  /** 是否正在检查更新 */
  isChecking: boolean;
  /** 是否正在下载更新 */
  isDownloading: boolean;
  /** 更新是否已就绪 */
  isUpdatePending: boolean;
  /** 下载进度 0~1 */
  downloadProgress?: number;
  /** 重启应用 */
  onApplyUpdate: () => void;
}

/**
 * 热更新提示横幅
 *
 * 显示三种状态：
 * - 检查中 / 下载中：带进度指示
 * - 下载完成：点击重启按钮
 * - 无更新：不渲染
 */
export default function UpdateBanner({
  isChecking,
  isDownloading,
  isUpdatePending,
  downloadProgress,
  onApplyUpdate,
}: UpdateBannerProps) {
  // 无更新或未开始检查时不显示
  if (!isChecking && !isDownloading && !isUpdatePending) {
    return null;
  }

  // 下载完成，等待重启
  if (isUpdatePending) {
    return (
      <View style={[styles.banner, styles.bannerReady]}>
        <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
        <Text style={styles.text}>新版本已就绪</Text>
        <TouchableOpacity style={styles.restartBtn} onPress={onApplyUpdate}>
          <Text style={styles.restartBtnText}>立即重启</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 检查中
  if (isChecking) {
    return (
      <View style={[styles.banner, styles.bannerChecking]}>
        <ActivityIndicator size="small" color="#FFFFFF" />
        <Text style={styles.text}>正在检查更新...</Text>
      </View>
    );
  }

  // 下载中
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
  bannerReady: {
    backgroundColor: "#059669",
  },
  bannerChecking: {
    backgroundColor: "#4F46E5",
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
  restartBtn: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  restartBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
