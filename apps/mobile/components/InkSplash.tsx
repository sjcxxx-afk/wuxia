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
import PaperGrain from "./Texture/PaperGrain";
import { colors } from "../lib/theme";

type Props = {
  /** 入场播完 —— 此刻调用 SplashScreen.hideAsync()，原生页即无痕消失 */
  onEntered: () => void;
  /** 退场播完 —— 此刻可以卸载本组件 */
  onExited: () => void;
  /** false 时开始退场 */
  active: boolean;
};

/** 入场总时长（ms），onEntered 在这段时间后触发 */
export const INK_SPLASH_ENTER_MS = 820;
/** 退场时长（ms） */
export const INK_SPLASH_EXIT_MS = 300;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

/**
 * 水墨启动页
 *
 * 它修掉的是历史上真正的根因：原先 assets/splash-icon.png 是**带圆角和渐变的
 * 满幅应用图标**，被 app.json 当启动图压在 #4F46E5 底色上，于是「方块套方块」。
 * 现在原生启动页改为纯宣纸色（app.json 已去掉 image），由本组件接手品牌表达。
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

  /* 退场 */
  useEffect(() => {
    if (active) return;
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
      {/* 宣纸上洇开的两处淡墨 */}
      <View style={styles.washTop} />
      <View style={styles.washBottom} />
      {/* fiber 变体只在这里用：启动页是唯一不滚动的整屏表面，
          不会与页面底部的 fine 纹理叠加（叠加会破 6% 铁律） */}
      <PaperGrain variant="fiber" />

      <View style={styles.content}>
        <Animated.View style={chestStyle}>
          <Icon
            name="chest"
            size={Math.min(132, SCREEN_W * 0.3)}
            color={colors.text}
            strokeWidth={1.5}
          />
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
  washTop: {
    position: "absolute",
    top: -SCREEN_H * 0.18,
    left: -SCREEN_W * 0.2,
    width: SCREEN_W * 1.4,
    height: SCREEN_H * 0.55,
    borderRadius: SCREEN_W,
    backgroundColor: colors.text,
    opacity: 0.035,
  },
  washBottom: {
    position: "absolute",
    bottom: -SCREEN_H * 0.24,
    right: -SCREEN_W * 0.25,
    width: SCREEN_W * 1.3,
    height: SCREEN_H * 0.5,
    borderRadius: SCREEN_W,
    backgroundColor: colors.text,
    opacity: 0.025,
  },
  titleBlock: { alignItems: "center", marginTop: 26 },
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
