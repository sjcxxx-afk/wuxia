import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppState, AppStateStatus } from "react-native";
import { useEffect, useRef } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { flushData } from "../lib/storage/jsonStore";
import { useAppUpdates } from "../lib/updates/useAppUpdates";
import UpdateBanner from "../components/UpdateBanner";

export default function RootLayout() {
  const appState = useRef(AppState.currentState);
  const {
    isChecking,
    isDownloading,
    isUpdatePending,
    downloadProgress,
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
      <UpdateBanner
        isChecking={isChecking}
        isDownloading={isDownloading}
        isUpdatePending={isUpdatePending}
        downloadProgress={downloadProgress}
        onApplyUpdate={applyUpdate}
      />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SafeAreaProvider>
  );
}
