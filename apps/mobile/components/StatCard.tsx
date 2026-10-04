import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors } from "../lib/theme";

type Props = {
  label: string;
  value: string;
  color?: string;
  onPress?: () => void;
};

export default function StatCard({ label, value, color = colors.accent, onPress }: Props) {
  if (onPress) {
    return (
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
        <Text style={[styles.value, { color }]}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={styles.card}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.surfaceSunken,
  },
  value: { fontSize: 24, fontWeight: "700" },
  label: { fontSize: 12, color: colors.textTertiary, marginTop: 4 },
});