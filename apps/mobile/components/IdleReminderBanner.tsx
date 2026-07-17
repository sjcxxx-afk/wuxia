import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  /** 超过阈值的闲置物品数 */
  count: number;
  /** 提醒阈值天数 */
  thresholdDays: number;
};

export default function IdleReminderBanner({ count, thresholdDays }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || count === 0) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.content}>
        <View style={styles.iconBox}>
          <Ionicons name="alarm-outline" size={20} color="#D97706" />
        </View>
        <View style={styles.textBox}>
          <Text style={styles.title}>
            {count} 件匣物闲置超过 {thresholdDays} 天
          </Text>
          <Text style={styles.subtitle}>点击查看，也许该处理一下了</Text>
        </View>
        <TouchableOpacity style={styles.dismiss} onPress={() => setDismissed(true)}>
          <Ionicons name="close" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.action}
        onPress={() => router.push("/(tabs)/items/idle")}
      >
        <Text style={styles.actionText}>查看闲置匣物</Text>
        <Ionicons name="chevron-forward" size={16} color="#D97706" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    overflow: "hidden",
  },
  content: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
  },
  textBox: { flex: 1 },
  title: { fontSize: 14, fontWeight: "700", color: "#92400E" },
  subtitle: { fontSize: 12, color: "#A16207", marginTop: 2 },
  dismiss: { padding: 2 },
  action: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#FDE68A",
    backgroundColor: "#FEF3C7",
  },
  actionText: { fontSize: 13, fontWeight: "600", color: "#D97706" },
});
