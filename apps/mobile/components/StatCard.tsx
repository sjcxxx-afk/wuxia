import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

type Props = {
  label: string;
  value: string;
  color?: string;
  onPress?: () => void;
};

export default function StatCard({ label, value, color = "#4F46E5", onPress }: Props) {
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
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  value: { fontSize: 24, fontWeight: "700" },
  label: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },
});