import { View, Text, StyleSheet } from "react-native";

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  "使用中": { bg: "#DCFCE7", text: "#166534", label: "使用中" },
  "闲置中": { bg: "#FEF3C7", text: "#92400E", label: "闲置中" },
  "已损坏": { bg: "#FEE2E2", text: "#991B1B", label: "已损坏" },
  "已出售": { bg: "#E0E7FF", text: "#3730A3", label: "已出售" },
  "已送人": { bg: "#F3E8FF", text: "#6B21A8", label: "已送人" },
  "收藏中": { bg: "#FCE7F3", text: "#9D174D", label: "收藏中" },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { bg: "#F3F4F6", text: "#374151", label: status };

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
