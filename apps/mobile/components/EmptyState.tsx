import { View, Text, StyleSheet } from "react-native";

import Icon from "./Icon";
import type { IconName } from "../lib/icons";
import { colors } from "../lib/theme";

type Props = {
  /**
   * 图标名。刻意用 `IconName` 而不是原先的 `keyof typeof Ionicons.glyphMap` ——
   * 后者把底层图标库的 glyph 名直接暴露给所有调用方，换图标库就得全量返工。
   */
  icon?: IconName;
  title: string;
  subtitle?: string;
};

export default function EmptyState({
  icon = "chest",
  title,
  subtitle,
}: Props) {
  return (
    <View style={styles.container}>
      <Icon name={icon} size={52} color={colors.iconMuted} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 80,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.textTertiary,
    marginTop: 16,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 6,
    textAlign: "center",
  },
});
