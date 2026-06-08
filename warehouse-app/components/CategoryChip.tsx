import { TouchableOpacity, Text, StyleSheet } from "react-native";

type Props = {
  label: string;
  color?: string;
  selected?: boolean;
  size?: "sm" | "md";
  onPress?: () => void;
};

export default function CategoryChip({
  label,
  color = "#E5E7EB",
  selected = false,
  size = "md",
  onPress,
}: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        size === "sm" ? styles.chipSm : styles.chipMd,
        { borderColor: selected ? "#4F46E5" : color },
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text
        style={[
          styles.text,
          size === "sm" ? styles.textSm : styles.textMd,
          selected && styles.textSelected,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  chipMd: { paddingHorizontal: 14, paddingVertical: 8 },
  chipSm: { paddingHorizontal: 10, paddingVertical: 5 },
  text: { color: "#374151", fontWeight: "500" },
  textMd: { fontSize: 14 },
  textSm: { fontSize: 12 },
  textSelected: { color: "#4F46E5", fontWeight: "600" },
});
