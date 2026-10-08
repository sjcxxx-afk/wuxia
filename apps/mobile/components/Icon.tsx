import { memo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { ICONS, type IconName } from "../lib/icons";
import { colors } from "../lib/theme";

export type IconProps = {
  /** 语义名（chest / shelf / search / seal / plus …），不是字形名 */
  name: IconName;
  /** 边长（px） */
  size?: number;
  /** 颜色。默认取 theme 语义色，业务代码里请勿硬编码色值 */
  color?: string;
  /**
   * 选中态。切到 Ionicons 的实心变体 ——
   * 比「叠加笔画 + 描边加粗」干净，也是 Ionicons 自己的惯例。
   */
  active?: boolean;
  /**
   * 无障碍标签。不传则视为装饰性图标（对读屏隐藏）——
   * 图标旁通常已有文字标签，重复朗读反而更糟。
   */
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * 图标
 *
 * 只暴露**语义名**，不暴露字形名 —— 字形全部收在 lib/icons.ts 里，
 * 将来换图标库不需要动任何调用点。
 *
 * memo 是必要的：图标在列表里大量重复，父组件每次 re-render
 * 都会因为新 props 触发一次 Ionicons 内部的重建。
 */
function IconBase({
  name,
  size = 24,
  color = colors.icon,
  active = false,
  label,
  style,
}: IconProps) {
  const def = ICONS[name];

  // 图标名拼错时静默返回占位盒，比整页白屏好排查
  if (!def) {
    if (__DEV__) console.warn(`[Icon] 未注册的图标名：${name}`);
    return <View style={[{ width: size, height: size }, style]} />;
  }

  const glyph = active ? def.filled : def.outline;

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
      <Ionicons name={glyph} size={size} color={color} />
    </View>
  );
}

export const Icon = memo(IconBase);
export default Icon;
