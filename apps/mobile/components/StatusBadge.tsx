import { View, Text, StyleSheet } from "react-native";
import { colors } from "../lib/theme";

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  "使用中": { bg: colors.successSoft, text: colors.success, label: "使用中" },
  "闲置中": { bg: colors.warningSoft, text: colors.warning, label: "闲置中" },
  "已损坏": { bg: colors.dangerSoft, text: colors.danger, label: "已损坏" },
  "已出售": { bg: colors.accentSoft, text: colors.accent, label: "已出售" },
  "已送人": { bg: colors.accentSoft, text: colors.accent, label: "已送人" },
  "收藏中": { bg: colors.accentSoft, text: colors.accent, label: "收藏中" },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { bg: colors.surfaceSunken, text: colors.text, label: status };

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  text: { fontSize: 12, fontWeight: "600" },
});
