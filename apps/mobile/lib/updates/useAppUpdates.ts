import { useEffect, useCallback, useState, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import * as Updates from "expo-updates";

/**
 * 热更新 Hook — 用户自主选择是否下载与重启
 *
 * 行为：
 * - 启动及回到前台时静默检查更新（不展示「检查中」横幅）
 * - 发现新版本后提示用户，由用户决定是否下载
 * - 下载完成后提示用户，由用户决定何时重启
 */
export function useAppUpdates() {
  const updatesState = Updates.useUpdates();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const checkingRef = useRef(false);

  const checkForUpdate = useCallback(async () => {
    if (!Updates.isEnabled) return;
    if (checkingRef.current) return;

    checkingRef.current = true;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        setUpdateAvailable(true);
      }
    } catch (error) {
      console.log("[useAppUpdates] 检查更新失败:", error);
    } finally {
      checkingRef.current = false;
    }
  }, []);

  const downloadUpdate = useCallback(async () => {
    if (!Updates.isEnabled) return;
    try {
      await Updates.fetchUpdateAsync();
    } catch (error) {
      console.log("[useAppUpdates] 下载更新失败:", error);
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setDismissed(true);
  }, []);

  const applyUpdate = useCallback(async () => {
    try {
      await Updates.reloadAsync();
    } catch (error) {
      console.log("[useAppUpdates] 重启失败:", error);
    }
  }, []);

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

  const showBanner =
    !dismissed &&
    (updateAvailable || updatesState.isUpdatePending || updatesState.isDownloading);

  return {
    showBanner,
    updateAvailable,
    isDownloading: updatesState.isDownloading,
    isUpdatePending: updatesState.isUpdatePending,
    downloadProgress: updatesState.downloadProgress,
    checkForUpdate,
    downloadUpdate,
    dismissUpdate,
    applyUpdate,
  };
}
