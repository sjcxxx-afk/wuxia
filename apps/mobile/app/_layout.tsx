import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { AppState, AppStateStatus } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import InkSplash, { INK_SPLASH_ENTER_MS } from "../components/InkSplash";
import { colors } from "../lib/theme";
import { flushData } from "../lib/storage/jsonStore";

/**
 * 拦住原生启动页，交由 InkSplash 接管。
 * 必须在模块顶层调用（早于任何组件渲染），否则会先闪一下原生启动页。
 *
 * app.json 里已去掉 splash 的 image —— 原来那张图是**带圆角和渐变的满幅应用图标**，
 * 压在底色上就成了「方块套方块」，这是启动页难看的真正根因。
 * 现在原生启动页是纯宣纸色，与 InkSplash 首帧同色，hideAsync 的瞬间无痕。
 */
SplashScreen.preventAutoHideAsync().catch(() => {
  // 已隐藏之类的情况会 reject，忽略即可 —— 不该因为它阻断启动
});

// 原生启动页的退场做成瞬时，视觉上完全由 InkSplash 接管
SplashScreen.setOptions({ duration: 0, fade: false });

type Phase = "native" | "ink" | "gone";

export default function RootLayout() {
  const appState = useRef(AppState.currentState);
  /**
   * native：原生启动页可见（InkSplash 在下面静静铺着）
   * ink：原生页已藏，InkSplash 完整可见，准备退场
   * gone：InkSplash 已退场，界面完全交还给路由
   */
  const [phase, setPhase] = useState<Phase>("native");

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

  /**
   * InkSplash 入场播完 → 藏掉原生启动页。
   * 顺序不能反：先藏原生页会闪出未就绪的界面。
   */
  const handleEntered = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
    setPhase("ink");
  }, []);

  /** InkSplash 退场播完 → 卸载它，之后所有动画都是界面自己的事 */
  const handleExited = useCallback(() => setPhase("gone"), []);

  /**
   * 兜底：若 onEntered 一直没来（例如动画被系统打断），不能永远卡在启动页。
   * 留一倍余量。
   */
  useEffect(() => {
    if (phase !== "native") return;
    const guard = setTimeout(handleEntered, INK_SPLASH_ENTER_MS * 2);
    return () => clearTimeout(guard);
  }, [phase, handleEntered]);

  return (
    <SafeAreaProvider>
      {/* SDK 56 的 expo-status-bar 已移除 backgroundColor（edge-to-edge 下
          也不再由 status bar 绘制背景色），底色由 Stack 的 contentStyle 承担 */}
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>

      {phase !== "gone" ? (
        <InkSplash
          active={phase === "ink"}
          onEntered={handleEntered}
          onExited={handleExited}
        />
      ) : null}
    </SafeAreaProvider>
  );
}
