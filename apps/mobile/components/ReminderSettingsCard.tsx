import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getReminderSettings, saveReminderSettings } from "../lib/storage/reminderSettings";

const OPTIONS = [
  { days: 7, label: "7 天" },
  { days: 14, label: "14 天" },
  { days: 30, label: "30 天" },
  { days: 60, label: "60 天" },
  { days: 90, label: "90 天" },
];

export default function ReminderSettingsCard() {
  const [threshold, setThreshold] = useState(getReminderSettings().idleReminderDays);

  const handleChange = (days: number) => {
    setThreshold(days);
    saveReminderSettings({ idleReminderDays: days });
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="notifications-outline" size={18} color="#D97706" />
        </View>
        <Text style={styles.title}>闲置提醒</Text>
      </View>

      <Text style={styles.desc}>
        闲置超过设定天数的物品将出现在提醒中
      </Text>

      <View style={styles.optionsRow}>
        {OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.days}
            style={[styles.option, threshold === opt.days && styles.optionActive]}
            onPress={() => handleChange(opt.days)}
          >
            <Text
              style={[styles.optionText, threshold === opt.days && styles.optionTextActive]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 15, fontWeight: "600", color: "#374151" },
  desc: { fontSize: 13, color: "#6B7280", lineHeight: 19 },
  optionsRow: { flexDirection: "row", gap: 8 },
  option: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  optionActive: { backgroundColor: "#FEF3C7" },
  optionText: { fontSize: 13, color: "#6B7280" },
  optionTextActive: { color: "#D97706", fontWeight: "600" },
});
