import { useEffect } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import Icon from "./Icon";
import { colors } from "../lib/theme";
import {
  INK_SPLASH_ENTER_MS,
  INK_SPLASH_EXIT_MS,
  shouldRunExit,
} from "../lib/splashTiming";

export { INK_SPLASH_ENTER_MS, INK_SPLASH_EXIT_MS, INK_SPLASH_HARD_HIDE_MS, shouldRunExit } from "../lib/splashTiming";

type Props = {
  /** 入场播完 —— 此刻调用 SplashScreen.hideAsync()，原生页即无痕消失 */
  onEntered: () => void;
  /** 退场播完 —— 此刻可以卸载本组件 */
  onExited: () => void;
  /**
   * 是否已进入（入场播完）。**不是**「是否正在显示」——
   * 挂载时为 false，onEntered 触发后转 true，退场动画随之启动。
   */
  active: boolean;
};

/** 时序常量与退场闸门都在 lib/splashTiming.ts（纯逻辑，可被测试钉住） */


const { width: SCREEN_W } = Dimensions.get("window");

/**
 * 水墨启动页
 *
 * 它修掉的是历史上真正的根因：原先 assets/splash-icon.png 是**带圆角和渐变的
 * 满幅应用图标**，被 app.json 当启动图压在 #4F46E5 底色上，于是「方块套方块」。
 * 现在原生启动图换成 assets/splash-mark.png（脚本生成的**透明底**墨色木匣标记），
 * 底色改为宣纸色，与本组件首帧同色，hideAsync 的瞬间无痕。
 *
 * 注意 app.json 的 splash `image` 不能删：expo-splash-screen 会无条件把
 * @drawable/splashscreen_logo 写进 styles.xml，省略 image 会导致 AAPT2 资源链接失败。
 * scripts/check-native-resources.js 盯着这条。
 *
 * 与原生启动页的衔接：两者首帧是同一张宣纸色，所以 hideAsync 的瞬间无痕。
 * 顺序必须是「先播完入场，再隐藏原生页」，反之会闪一下未就绪的界面。
 *
 * 动效只碰 transform / opacity —— 启动瞬间最容易掉帧，不能触发 layout。
 */
export default function InkSplash({ onEntered, onExited, active }: Props) {
  const reduced = useReducedMotion();

  const veil = useSharedValue(0);
  const chestScale = useSharedValue(reduced ? 1 : 0.82);
  const chestOpacity = useSharedValue(reduced ? 1 : 0);
  const titleOpacity = useSharedValue(reduced ? 1 : 0);
  const titleY = useSharedValue(reduced ? 0 : 14);
  const subtitleOpacity = useSharedValue(reduced ? 1 : 0);

  /* 入场 */
  useEffect(() => {
    veil.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) });

    if (reduced) {
      chestOpacity.value = withTiming(1, { duration: 120 });
      titleOpacity.value = withTiming(1, { duration: 120 });
      subtitleOpacity.value = withTiming(1, { duration: 120 });
    } else {
      chestOpacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
      // 木匣「落定」的那一下微弹
      chestScale.value = withSequence(
        withSpring(1.06, { damping: 9, stiffness: 200, mass: 0.7 }),
        withSpring(1, { damping: 15, stiffness: 180, mass: 0.6 }),
      );
      titleOpacity.value = withDelay(280, withTiming(1, { duration: 420 }));
      titleY.value = withDelay(280, withSpring(0, { damping: 16, stiffness: 170, mass: 0.6 }));
      subtitleOpacity.value = withDelay(460, withTiming(1, { duration: 460 }));
    }

    const timer = setTimeout(onEntered, INK_SPLASH_ENTER_MS);
    return () => {
      clearTimeout(timer);
      cancelAnimation(veil);
      cancelAnimation(chestScale);
    };
  }, [reduced, veil, chestScale, chestOpacity, titleOpacity, titleY, subtitleOpacity, onEntered]);

  /* 呼吸感：极慢的起伏，让静止画面有生气。只在允许动效时开启 */
  useEffect(() => {
    if (reduced) return;
    chestScale.value = withRepeat(
      withSequence(
        withTiming(1.014, { duration: 2100, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2100, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(chestScale);
  }, [reduced, chestScale]);

  /**
   * 退场 —— 只在**入场播完之后**才开始。
   *
   * `active` 的语义是「入场已完成」：`_layout` 传的是 `phase === "ink"`，
   * 而 phase 要等 onEntered 触发后才从 native 变成 ink。
   * 所以这里必须 `if (!active) return`。
   *
   * 写成 `if (active) return` 会在挂载时（active 恰为 false）立刻开始退场，
   * 300ms 后调用 onExited 把本组件卸载掉 —— 入场动画才播了三分之一。
   * 连带后果更严重：_layout 里负责隐藏原生启动页的兜底定时器会因为
   * phase !== "native" 被清掉，hideAsync 永远不会被调用，
   * 原生启动页就永久停在屏幕上（release 包无红屏，看起来像「应用打不开」）。
   */
  useEffect(() => {
    if (!shouldRunExit(active)) return;
    cancelAnimation(chestScale);
    veil.value = withTiming(0, { duration: INK_SPLASH_EXIT_MS, easing: Easing.in(Easing.quad) });
    chestScale.value = withTiming(1.05, {
      duration: INK_SPLASH_EXIT_MS,
      easing: Easing.out(Easing.quad),
    });
    const timer = setTimeout(onExited, INK_SPLASH_EXIT_MS);
    return () => clearTimeout(timer);
  }, [active, veil, chestScale, onExited]);

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  const chestStyle = useAnimatedStyle(() => ({
    opacity: chestOpacity.value,
    transform: [{ scale: chestScale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));

  return (
    <Animated.View style={[styles.root, veilStyle]} pointerEvents="none">
      {/* 启动页保持纯净：只有纸白底 + 图标 + 字标。
          上一版这里叠了纸纹与两处墨晕，真实设备上结论是「又把界面弄脏了」 */}
      <View style={styles.content}>
        <Animated.View style={chestStyle}>
          <Icon name="chest" size={Math.min(112, SCREEN_W * 0.26)} color={colors.accent} />
        </Animated.View>

        <Animated.View style={[styles.titleBlock, titleStyle]}>
          <Text style={styles.title}>物匣</Text>
          <View style={styles.rule} />
        </Animated.View>

        <Animated.View style={subtitleStyle}>
          <Text style={styles.subtitle}>记录 · 整理 · 寻觅匣中之物</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  content: { alignItems: "center" },
  titleBlock: { alignItems: "center", marginTop: 22 },
  title: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 10,
    color: colors.text,
    // 字距会让末位偏左，补回来才真正居中
    marginLeft: 10,
  },
  rule: {
    width: 34,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
    marginTop: 14,
    opacity: 0.85,
  },
  subtitle: {
    marginTop: 16,
    fontSize: 13,
    letterSpacing: 3,
    color: colors.textTertiary,
    marginLeft: 3,
  },
});
