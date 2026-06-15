import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
};

export default function EmptyState({
  icon = "cube-outline",
  title,
  subtitle,
}: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={56} color="#D1D5DB" />
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
    color: "#9CA3AF",
    marginTop: 16,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#D1D5DB",
    marginTop: 6,
    textAlign: "center",
  },
});
