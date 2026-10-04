import { memo, useMemo } from "react";
import {
  Image as RNImage,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
// react-native-svg 的图片组件就叫 Image，与 RN 的 Image 同名，必须取别名
import Svg, { Defs, Pattern, Rect, Image as SvgImage } from "react-native-svg";

import { texture, textureTile } from "../../lib/theme";

/**
 * 静态资源在模块作用域解析一次。
 * 走 resolveAssetSource 而不是直接把 require 交给 SvgImage ——
 * 后者在 Android release 包里偶发拿不到 URI。
 */
const TILES = {
  fine: RNImage.resolveAssetSource(require("../../assets/textures/paper-fine.png")).uri,
  fiber: RNImage.resolveAssetSource(require("../../assets/textures/paper-fiber.png")).uri,
} as const;

export type PaperVariant = keyof typeof TILES;

export type PaperGrainProps = {
  /**
   * 铺面尺寸。不传则铺满父容器（父容器需有确定尺寸）。
   * 只建议用在不跟随滚动的bounded表面上：Pattern 每帧都要重新采样，
   * 铺在长列表里滚动时会有实测开销。
   */
  width?: number | string;
  height?: number | string;
  /** 不透明度，上限被 theme.texture.paperMaxOpacity 硬钳住 */
  opacity?: number;
  variant?: PaperVariant;
  /** 平铺边长（px），必须与生成器里的 size 一致，否则接缝会错位 */
  tile?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * 宣纸纹 —— 位图平铺。
 *
 * 为什么纸纹走位图而木纹走矢量：纸纹是细密无方向的颗粒，平铺不损失信息；
 * 木纹是横向线条，位图一拉伸就失真（见 WoodGrain 的注释）。
 *
 * 两条硬约束：
 *  1. 不透明度被 theme.texture.paperMaxOpacity（6%）钳住。
 *  2. fine 与 fiber 不可叠加 —— 两者峰值 alpha 合成后约 8.8%，会破线。
 *     这条约束由 scripts/__tests__/generate-textures.test.js 钉住。
 */
function PaperGrainBase({
  width = "100%",
  height = "100%",
  opacity = 1,
  variant = "fine",
  tile = textureTile.paper,
  style,
}: PaperGrainProps) {
  const alpha = Math.min(opacity, texture.paperMaxOpacity);
  const uri = TILES[variant];
  const patternId = useMemo(
    () => `paper-${variant}-${Math.round(tile)}`,
    [variant, tile],
  );

  if (alpha <= 0) return null;

  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
        <Defs>
          <Pattern id={patternId} patternUnits="userSpaceOnUse" width={tile} height={tile}>
            <SvgImage href={uri} x={0} y={0} width={tile} height={tile} />
          </Pattern>
        </Defs>
        <Rect
          x={0}
          y={0}
          width={width as number}
          height={height as number}
          fill={`url(#${patternId})`}
          opacity={alpha}
        />
      </Svg>
    </View>
  );
}

export const PaperGrain = memo(PaperGrainBase);
export default PaperGrain;
