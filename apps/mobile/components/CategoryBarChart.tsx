import { View, Text, StyleSheet } from "react-native";

import { colors } from "../lib/theme";

type BarDatum = {
  label: string;
  value: number;
  icon?: string;
  color?: string;
};

type Props = {
  data: BarDatum[];
  title: string;
  maxBars?: number;
};

/**
 * 分类色板。原先这里是 7 个 Tailwind 色随手排的；换成 theme 的 chart 色板后，
 * 相邻两档色相太近会分不清，所以只保留 4 档并按「色相尽量远」排列。
 * 四档实测都 ≥4.5:1，既能当色块也能当文字色。
 */
const COLORS = [
  colors.chart[0],
  colors.chart[1],
  colors.chart[2],
  colors.chart[3],
];

export default function CategoryBarChart({ data, title, maxBars = 8 }: Props) {
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, maxBars);
  const maxValue = Math.max(1, ...sorted.map((d) => d.value));

  if (sorted.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.empty}>暂无数据</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {sorted.map((d, i) => {
        const width = Math.max(4, Math.round((d.value / maxValue) * 100));
        const color = d.color ?? COLORS[i % COLORS.length];
        return (
          <View key={d.label} style={styles.row}>
            <View style={styles.labelRow}>
              {d.icon ? <Text style={styles.icon}>{d.icon}</Text> : null}
              <Text style={styles.label} numberOfLines={1}>{d.label}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { width: `${width}%`, backgroundColor: color }]} />
            </View>
            <Text style={styles.value}>{d.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceSunken,
    gap: 10,
  },
  title: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 2 },
  empty: { fontSize: 13, color: colors.textTertiary, textAlign: "center", paddingVertical: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  labelRow: {
    width: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  icon: { fontSize: 14 },
  label: { fontSize: 12, color: colors.text, flexShrink: 1 },
  barTrack: {
    flex: 1,
    height: 18,
    backgroundColor: colors.surfaceSunken,
    borderRadius: 4,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: 4,
    minWidth: 4,
  },
  value: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, width: 32, textAlign: "right" },
});
