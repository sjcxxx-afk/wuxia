import { memo, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Ellipse, G, Path } from "react-native-svg";

import { palette, texture } from "../../lib/theme";

/** 确定性伪随机：同一 seed 永远得到同一张木纹，避免每次 re-render 都在跳 */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type WoodGrainProps = {
  width: number;
  height: number;
  /** 不透明度，上限被 theme.texture.woodMaxOpacity 硬钳住 */
  opacity?: number;
  /** 木纹线颜色 */
  color?: string;
  /** 同一区域请保持 seed 一致，否则纹理会「跳动」 */
  seed?: number;
  /** 年轮密度，默认按高度自动决定 */
  density?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * 木纹 —— 矢量绘制，不用位图。
 *
 * 为什么不用位图：木纹是**有方向的线条**。位图拉伸到全屏必然模糊失真，
 * 而矢量在任何分辨率下都锐利、内存几乎为零，缩放动画也不掉帧。
 *
 * 铁律：不透明度被 theme.texture.woodMaxOpacity（10%）硬钳住。
 * 木纹一旦超过这个值就会开始「茶室风」，这不是审美偏好问题。
 */
function WoodGrainBase({
  width,
  height,
  opacity = 0.5,
  color = palette.wood,
  seed = 7,
  density,
  style,
}: WoodGrainProps) {
  // 硬钳铁律。宁可少画，也不越线。
  const alpha = Math.min(opacity, texture.woodMaxOpacity);

  const { rings, knots } = useMemo(() => {
    if (width <= 0 || height <= 0 || alpha <= 0) {
      return { rings: [] as string[], knots: [] as number[][] };
    }

    const rnd = mulberry32(seed);
    const count = density ?? Math.max(3, Math.min(14, Math.round(height / 5.5)));

    // 木纹线：横向流过，用二次谐波制造不规则，避免机械的正弦感
    const lines: string[] = [];
    for (let i = 0; i < count; i++) {
      const baseY = ((i + 0.5) / count) * height;
      const amp = height * (0.035 + rnd() * 0.05);
      const phase = rnd() * Math.PI * 2;
      const w1 = 0.22 + rnd() * 0.12;
      const w2 = 0.55 + rnd() * 0.15;
      const skew = (rnd() - 0.5) * height * 0.06;

      // 四个控制点跑一条三次贝塞尔，横贯整个宽度
      const c1x = width * w1;
      const c2x = width * w2;
      const c1y = baseY + Math.sin(phase) * amp;
      const c2y = baseY + Math.sin(phase + 1.9) * amp + skew;
      const endY = baseY + Math.sin(phase + 0.7) * amp * 0.5;
      lines.push(
        `M0 ${baseY.toFixed(2)} C${c1x.toFixed(2)} ${c1y.toFixed(2)}, ` +
          `${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${width.toFixed(2)} ${endY.toFixed(2)}`,
      );
    }

    // 木节：同心椭圆。木头有节才像木头，但数量要少，多了就脏
    const knotCount = width > 260 && height > 28 && rnd() > 0.45 ? 1 : 0;
    const knotSpecs: number[][] = [];
    for (let k = 0; k < knotCount; k++) {
      const cx = width * (0.18 + rnd() * 0.64);
      const cy = height * (0.3 + rnd() * 0.4);
      knotSpecs.push([cx, cy, Math.min(height * 0.42, 7 + rnd() * 5)]);
    }

    return { rings: lines, knots: knotSpecs };
  }, [width, height, seed, density, alpha]);

  if (alpha <= 0 || rings.length === 0) return null;

  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
        <G stroke={color} strokeWidth={1} strokeLinecap="round" opacity={alpha}>
          {rings.map((d, i) => (
            <Path key={i} d={d} />
          ))}
          {knots.map(([cx, cy, r], i) => (
            <G key={`k${i}`}>
              <Ellipse cx={cx} cy={cy} rx={r * 2.1} ry={r} />
              <Ellipse cx={cx} cy={cy} rx={r * 1.25} ry={r * 0.58} />
              <Ellipse cx={cx} cy={cy} rx={r * 0.5} ry={r * 0.22} />
            </G>
          ))}
        </G>
      </Svg>
    </View>
  );
}

export const WoodGrain = memo(WoodGrainBase);
export default WoodGrain;
