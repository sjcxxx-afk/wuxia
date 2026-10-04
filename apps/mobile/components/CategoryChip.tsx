import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { colors } from "../lib/theme";

type Props = {
  label: string;
  color?: string;
  selected?: boolean;
  size?: "sm" | "md";
  onPress?: () => void;
};

export default function CategoryChip({
  label,
  color = colors.border,
  selected = false,
  size = "md",
  onPress,
}: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        size === "sm" ? styles.chipSm : styles.chipMd,
        { borderColor: selected ? colors.accent : color },
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
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  chipMd: { paddingHorizontal: 14, paddingVertical: 8 },
  chipSm: { paddingHorizontal: 10, paddingVertical: 5 },
  text: { color: colors.text, fontWeight: "500" },
  textMd: { fontSize: 14 },
  textSm: { fontSize: 12 },
  textSelected: { color: colors.accent, fontWeight: "600" },
});
