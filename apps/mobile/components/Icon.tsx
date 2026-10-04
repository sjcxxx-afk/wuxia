import { memo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { G, Path } from "react-native-svg";

import { ICONS, type IconName } from "../lib/icons";
import { colors } from "../lib/theme";

export type IconProps = {
  name: IconName;
  /**
   * 边长（px）。视图框恒为 24，视觉上等比缩放。
   * 小尺寸下自动略微加粗笔画，否则 16px 的 1.7 描边会显得虚。
   */
  size?: number;
  /** 描边色。默认取 theme 语义色，不传色值请勿硬编码 */
  color?: string;
  /** 选中态：额外叠一层「着墨更实」的笔画 */
  active?: boolean;
  /** 手动指定描边粗细（24 视图框下的 path 单位） */
  strokeWidth?: number;
  /**
   * 无障碍标签。不传则视为装饰性图标（对读屏隐藏）——
   * 图标旁通常已有文字标签，重复朗读反而更糟。
   */
  label?: string;
  style?: StyleProp<ViewStyle>;
};

const VIEW_BOX = 24;

/** 小尺寸补偿：描边随尺寸变小会显得虚，按经验略微加粗 */
function resolveStrokeWidth(size: number, override?: number): number {
  if (typeof override === "number") return override;
  if (size < 18) return 2.1;
  if (size < 22) return 1.9;
  if (size < 30) return 1.8;
  return 1.7;
}

/**
 * 木墨图标
 *
 * 只描边不填充 —— 填充会让「毛笔」的轻盈感变成实心块，与纸墨的轻盈冲突。
 * 选中态靠 additional strokes 表达，而不是靠加粗。
 *
 * memo 是必要的：图标在列表里大量重复，父组件每次 re-render
 * 都会因为新 props 而触发 Svg 的 diff。
 */
function IconBase({
  name,
  size = 24,
  color = colors.icon,
  active = false,
  strokeWidth,
  label,
  style,
}: IconProps) {
  const def = ICONS[name];

  // 图标名拼错时静默返回空盒，比整页白屏好排查
  if (!def) {
    if (__DEV__) console.warn(`[Icon] 未注册的图标名：${name}`);
    return <View style={[{ width: size, height: size }, style]} />;
  }

  const sw = resolveStrokeWidth(size, strokeWidth);
  const strokeProps = {
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible={label != null}
      accessibilityLabel={label}
      accessibilityRole={label != null ? "image" : "none"}
      // 没给 label 时明确对读屏隐藏，否则读屏会把一排图标念成「图像 图像 图像」
      accessibilityElementsHidden={label == null}
      importantForAccessibility={label == null ? "no-hide-descendants" : "yes"}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`} fill="none">
        <G {...strokeProps}>
          {def.paths.map((d, i) => (
            <Path key={`b${i}`} d={d} />
          ))}
        </G>
        {active && def.active ? (
          <G {...strokeProps}>
            {def.active.map((d, i) => (
              <Path key={`a${i}`} d={d} />
            ))}
          </G>
        ) : null}
      </Svg>
    </View>
  );
}

export const Icon = memo(IconBase);
export default Icon;
