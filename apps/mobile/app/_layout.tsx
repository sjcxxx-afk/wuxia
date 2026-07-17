import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppState, AppStateStatus } from "react-native";
import { useEffect, useRef } from "react";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { flushData } from "../lib/storage/jsonStore";
import { useAppUpdates } from "../lib/updates/useAppUpdates";
import UpdateBanner from "../components/UpdateBanner";

export default function RootLayout() {
  const appState = useRef(AppState.currentState);
  const {
    showBanner,
    updateAvailable,
    isDownloading,
    isUpdatePending,
    downloadProgress,
    downloadUpdate,
    dismissUpdate,
    applyUpdate,
  } = useAppUpdates();

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        flushData();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <SafeAreaView edges={["top"]}>
        <UpdateBanner
          visible={showBanner}
          updateAvailable={updateAvailable}
          isDownloading={isDownloading}
          isUpdatePending={isUpdatePending}
          downloadProgress={downloadProgress}
          onDownloadUpdate={downloadUpdate}
          onApplyUpdate={applyUpdate}
          onDismiss={dismissUpdate}
        />
      </SafeAreaView>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SafeAreaProvider>
  );
}
