import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import Icon from "./Icon";
import WoodGrain from "./Texture/WoodGrain";
import { TAB_ICONS, type IconName } from "../lib/icons";
import { colors, motion, spacing } from "../lib/theme";

/** 顶部滑动的朱砂标记（「闩」）尺寸 */
const MARK_WIDTH = 22;
const MARK_HEIGHT = 3;
/** 图标尺寸 */
const ICON_SIZE = 25;
/** 木条高度（不含底部安全区） */
export const WOOD_TAB_BAR_HEIGHT = 58;

/**
 * BottomTabBarProps 只能从 expo-router 的内部路径取 —— 它的包根没有再导出这个类型，
 * 而 @react-navigation/bottom-tabs 并不是本项目的直接依赖（根本没装）。
 * 这是 type-only import，运行时零影响；万一 expo-router 升级改了内部路径，
 * 也只会编译报错，不会让 App 崩。真到那天再换成本地结构化类型即可。
 */
type BottomTabBarProps = import("expo-router/build/react-navigation/bottom-tabs").BottomTabBarProps;

export type WoodTabBarProps = BottomTabBarProps & {
  /** 由 (tabs)/_layout.tsx 传入，导航栏自己算 insets 会闪一下 */
  bottomInset: number;
};

/* ------------------------------------------------------------ 单个 Tab */

type TabItemProps = {
  iconName: IconName;
  label: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

/**
 * 一个导航项。三层反馈，缺一不可：
 *   1. 按压缩放（spring 回弹）。不用 opacity 淡入 —— 那在木纹底上很脏，
 *      而且 opacity 变化会连带影响木纹的观感。
 *   2. 图标换色 + 补上「着墨」笔画（active 态多一笔，不是单纯变色）。
 *   3. 标签字重 600 vs 500：小字号下字重变化比颜色变化更容易被感知。
 */
function TabItemBase({ iconName, label, isFocused, onPress, onLongPress }: TabItemProps) {
  const reduced = useReducedMotion();
  const press = useSharedValue(0);
  const pop = useSharedValue(1);

  // 变成选中时的一次性弹跳
  useEffect(() => {
    if (reduced) return;
    if (isFocused) {
      pop.value = withSequence(
        withSpring(motion.iconPopScale, motion.springBouncy),
        withSpring(1, motion.spring),
      );
    } else {
      cancelAnimation(pop);
      pop.value = withSpring(1, motion.spring);
    }
  }, [isFocused, reduced, pop]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * (1 - motion.pressScale) }],
  }));
  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));
  const inactiveStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isFocused ? 0 : 1, { duration: motion.durationFast }),
  }));
  const activeStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isFocused ? 1 : 0, {
      duration: isFocused ? motion.durationBase : motion.durationFast,
      easing: Easing.out(Easing.quad),
    }),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isFocused ? 1 : 0.72, { duration: motion.durationFast }),
  }));

  return (
    <Pressable
      onPressIn={() => {
        press.value = withTiming(1, {
          duration: motion.durationFast,
          easing: Easing.out(Easing.quad),
        });
      }}
      onPressOut={() => {
        press.value = withSpring(0, motion.spring);
      }}
      onPress={onPress}
      onLongPress={onLongPress}
      // Android 原生水波纹给即时的触觉反馈，与缩放动画叠加不冲突
      android_ripple={{ color: colors.woodInk, borderless: false }}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
      style={styles.pressable}
    >
      <Animated.View style={[styles.item, containerStyle]}>
        <Animated.View style={[styles.iconWrap, iconWrapStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, inactiveStyle]}>
            <Icon name={iconName} size={ICON_SIZE} color={colors.iconOnWood} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, activeStyle]}>
            <Icon name={iconName} size={ICON_SIZE} color={colors.accentOnWood} active />
          </Animated.View>
        </Animated.View>

        <Animated.Text
          numberOfLines={1}
          style={[
            styles.label,
            { color: isFocused ? colors.text : colors.textSecondary },
            isFocused ? styles.labelActive : null,
            labelStyle,
          ]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const TabItem = memo(TabItemBase);


/* ---------------------------------------------------------------- 木架 */

/**
 * 底部导航栏 —— 一块浅木条。
 *
 * 为什么是木条而不是浮层药丸：产品叫「物匣」，木条读作一层搁板，
 * 四个图标是搁板上的四件器物。浮层玻璃那套是通用 App 语汇，和木墨冲突。
 *
 * 木纹用矢量绘制（见 Texture/WoodGrain），因此在任意宽度下都锐利、
 * 不会有位图拉伸的失真，滚动与旋转时也不掉帧。
 */
function WoodTabBarBase({ state, descriptors, navigation, bottomInset }: WoodTabBarProps) {
  const reduced = useReducedMotion();
  const [barWidth, setBarWidth] = useState(0);
  const markX = useSharedValue(0);
  /** 首次挂载不算「切换」，不要在冷启动时震一下 */
  const firstRun = useRef(true);

  const { index, routes } = state;
  const tabWidth = routes.length > 0 ? barWidth / routes.length : 0;

  // 朱砂标记滑到选中项
  useEffect(() => {
    if (tabWidth <= 0) return;
    markX.value = reduced
      ? withTiming(index * tabWidth, { duration: motion.durationFast })
      : withSpring(index * tabWidth, motion.spring);
  }, [index, tabWidth, reduced, markX]);

  // 切换时的轻触感：木质「叩」一下。失败（设备不支持）静默忽略。
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    Haptics.selectionAsync().catch(() => {});
  }, [index]);

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: markX.value }],
  }));

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  }, []);

  const makePress = useCallback(
    (routeKey: string, routeName: string, params: object | undefined) => () => {
      const event = navigation.emit({
        type: "tabPress",
        target: routeKey,
        canPreventDefault: true,
      });
      // 默认行为是「重复点当前页回到栈顶」，被 preventDefault 就不要越权
      if (!event.defaultPrevented) {
        navigation.navigate(routeName, params);
      }
    },
    [navigation],
  );

  const makeLongPress = useCallback(
    (routeKey: string) => () => {
      // tabLongPress 的事件定义里没有 canPreventDefault（只有 tabPress 有），
      // 多传会被 TS 的字面量检查挡下
      navigation.emit({ type: "tabLongPress", target: routeKey });
    },
    [navigation],
  );

  return (
    <View
      style={[styles.bar, { paddingBottom: bottomInset, height: WOOD_TAB_BAR_HEIGHT + bottomInset }]}
    >
      {/* 木纹。pointerEvents none，保证整条木条都能接收点击 */}
      {barWidth > 0 ? (
        <WoodGrain width={barWidth} height={WOOD_TAB_BAR_HEIGHT} seed={11} opacity={0.55} />
      ) : null}

      {/* 顶部一道浅色高光，木条才有厚度 */}
      <View style={styles.topHighlight} pointerEvents="none" />

      {/* 滑动朱砂标记：定位在木条顶缘，视觉上像一道「闩」 */}
      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.mark,
            { left: (tabWidth - MARK_WIDTH) / 2 },
            markStyle,
          ]}
        />
      ) : null}

      <View style={styles.row} onLayout={handleLayout}>
        {routes.map((route, i) => {
          const options = descriptors[route.key]?.options ?? {};
          const label =
            typeof options.title === "string" && options.title.length > 0
              ? options.title
              : route.name;
          const iconName = TAB_ICONS[route.name as keyof typeof TAB_ICONS] ?? "chest";
          return (
            <TabItem
              key={route.key}
              iconName={iconName}
              label={label}
              isFocused={i === index}
              onPress={makePress(route.key, route.name, route.params)}
              onLongPress={makeLongPress(route.key)}
            />
          );
        })}
      </View>
    </View>
  );
}

export const WoodTabBar = memo(WoodTabBarBase);
export default WoodTabBar;

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.tabBar,
    // 顶缘的木色描边替代原来的灰色分割线 —— 灰线在木色上会显脏
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.tabBarBorder,
    overflow: "hidden",
  },
  topHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.surface,
    opacity: 0.5,
  },
  mark: {
    position: "absolute",
    top: 0,
    width: MARK_WIDTH,
    height: MARK_HEIGHT,
    borderRadius: MARK_HEIGHT / 2,
    backgroundColor: colors.accentOnWood,
  },
  row: {
    flexDirection: "row",
    height: WOOD_TAB_BAR_HEIGHT,
  },
  pressable: {
    flex: 1,
    // 木纹只铺非安全区那 58px，按压区与视觉区对齐
    height: WOOD_TAB_BAR_HEIGHT,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.sm,
    gap: 3,
  },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
    includeFontPadding: false,
  },
  labelActive: {
    fontWeight: "700",
  },
});
