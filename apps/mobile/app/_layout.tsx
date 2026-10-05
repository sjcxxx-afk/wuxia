import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { AppState, AppStateStatus } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import InkSplash, {
  INK_SPLASH_ENTER_MS,
  INK_SPLASH_HARD_HIDE_MS,
} from "../components/InkSplash";
import { colors } from "../lib/theme";
import { flushData } from "../lib/storage/jsonStore";

/**
 * 拦住原生启动页，交由 InkSplash 接管。
 * 必须在模块顶层调用（早于任何组件渲染），否则会先闪一下原生启动页。
 *
 * app.json 的 splash image 已换成 assets/splash-mark.png（透明底标记）——
 * 原来那张是带圆角和渐变的满幅应用图标，压在底色上就成了「方块套方块」。
 * 但**不能删掉 image**：expo-splash-screen 会无条件引用
 * @drawable/splashscreen_logo，省略它会导致 AAPT2 资源链接失败。
 *
 * 无论启动页那边出什么问题，都必须保证原生页被隐藏 —— 它一旦留在屏幕上，
 * 底下所有界面都看不见，而 release 包没有红屏浮层，用户只会觉得「应用打不开」。
 */
SplashScreen.preventAutoHideAsync().catch(() => {
  // 已隐藏之类的情况会 reject，忽略即可 —— 不该因为它阻断启动
});

// 原生启动页的退场做成瞬时，视觉上完全由 InkSplash 接管
SplashScreen.setOptions({ duration: 0, fade: false });

/**
 * 硬性兜底：无论 InkSplash 的动画与回调是否正常，最多 2.5s 后一定把原生页收掉。
 * 这个定时器挂在模块作用域，不受任何组件生命周期影响 ——
 * 之前挂在 useEffect 里，组件一旦被提前卸载就会连兜底一起丢掉。
 */
const HARD_HIDE_MS = INK_SPLASH_HARD_HIDE_MS;
setTimeout(() => {
  SplashScreen.hideAsync().catch(() => {});
}, HARD_HIDE_MS);

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
   * 兜底：若 onEntered 一直没来（例如入场动画被系统打断），不能永远卡在启动页。
   * 留一倍余量。模块作用域那个 HARD_HIDE_MS 是最后一道防线，这个只是提前收。
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
