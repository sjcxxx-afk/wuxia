import { memo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { colors, texture } from "../../lib/theme";
import PaperGrain from "./PaperGrain";

export type PaperSurfaceProps = {
  style?: StyleProp<ViewStyle>;
  /** 晕染位置。top 适合顶栏下方的压暗，bottom 适合列表尾部收束 */
  wash?: "none" | "top" | "bottom";
  /**
   * 是否叠加纸纹颗粒。
   * 默认关闭 —— 页面底通常在滚动容器里，Pattern 每帧重采样有实测开销；
   * 需要质感的 bounded 表面（空状态、弹层、启动页）再显式打开。
   */
  grain?: boolean;
  children?: React.ReactNode;
};

/** 晕染落点与铺展。viewBox 用百分比坐标配合 preserveAspectRatio="none" */
const WASH = {
  top: { cx: "50%", cy: "0%", rx: "85%", ry: "46%" },
  bottom: { cx: "50%", cy: "100%", rx: "85%", ry: "42%" },
} as const;

type WashKind = keyof typeof WASH;

/**
 * 宣纸底 —— 页面根容器。
 *
 * 三层叠加，从下到上：
 *   1. 实底宣纸色（文字压在这一层上，对比度已由 check-theme-contrast 守住）
 *   2. 极淡的墨晕（矢量 RadialGradient，几乎零成本）
 *   3. 可选的纸纹颗粒（位图平铺，默认关闭）
 *
 * 为什么晕染用矢量而不用纸纹：墨晕是低频的，矢量拉伸不损失；
 * 纸纹是高频颗粒，铺在滚动页面里每帧重采样，Android 上有实测开销。
 */
function PaperSurfaceBase({
  style,
  wash = "top",
  grain = false,
  children,
}: PaperSurfaceProps) {
  const spec: WashKind | null = wash === "none" ? null : wash;

  return (
    <View style={[styles.base, style]}>
      {spec ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <Defs>
              <RadialGradient
                id="inkWash"
                cx={WASH[spec].cx}
                cy={WASH[spec].cy}
                rx={WASH[spec].rx}
                ry={WASH[spec].ry}
              >
                <Stop offset="0" stopColor={colors.text} stopOpacity={texture.inkMaxOpacity * 0.28} />
                <Stop offset="0.55" stopColor={colors.text} stopOpacity={texture.inkMaxOpacity * 0.08} />
                <Stop offset="1" stopColor={colors.text} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={100} height={100} fill="url(#inkWash)" />
          </Svg>
        </View>
      ) : null}
      {grain ? <PaperGrain variant="fine" /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

export const PaperSurface = memo(PaperSurfaceBase);
export default PaperSurface;
