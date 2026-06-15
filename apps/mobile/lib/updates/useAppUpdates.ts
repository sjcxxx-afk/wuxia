import { useEffect, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import * as Updates from "expo-updates";

/**
 * 热更新 Hook — 封装 expo-updates 的检查、下载、状态监听
 *
 * 行为：
 * - App 启动时自动检查更新
 * - 发现新版本后自动后台下载
 * - App 从后台回到前台时重新检查
 * - 下载完成后通过 isUpdatePending 通知 UI 层
 */
export function useAppUpdates() {
  const updatesState = Updates.useUpdates();

  // 手动检查更新
  const checkForUpdate = useCallback(async () => {
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        // 发现更新，自动下载
        const fetchResult = await Updates.fetchUpdateAsync();
        if (fetchResult.isNew) {
          // 更新已下载，等用户重启 App
        }
      }
    } catch (error) {
      // 开发模式或更新不可用时静默处理
      console.log("[useAppUpdates] 检查更新失败:", error);
    }
  }, []);

  // 应用更新：立即重启 App
  const applyUpdate = useCallback(async () => {
    try {
      await Updates.reloadAsync();
    } catch (error) {
      console.log("[useAppUpdates] 重启失败:", error);
    }
  }, []);

  // 启动时 + 回到前台时检查更新
  useEffect(() => {
    checkForUpdate();

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        checkForUpdate();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [checkForUpdate]);

  return {
    /** 是否正在检查更新 */
    isChecking: updatesState.isChecking,
    /** 是否正在下载更新 */
    isDownloading: updatesState.isDownloading,
    /** 是否有可用更新 */
    isUpdateAvailable: updatesState.isUpdateAvailable,
    /** 更新是否已下载完毕，等待重启 */
    isUpdatePending: updatesState.isUpdatePending,
    /** 更新检查错误 */
    checkError: updatesState.checkError,
    /** 下载错误 */
    downloadError: updatesState.downloadError,
    /** 下载进度 0~1 */
    downloadProgress: updatesState.downloadProgress,
    /** 当前运行的版本信息 */
    currentlyRunning: updatesState.currentlyRunning,
    /** 手动检查更新 */
    checkForUpdate,
    /** 立即重启应用应用更新 */
    applyUpdate,
  };
}
