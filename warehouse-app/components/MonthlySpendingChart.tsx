import { View, Text, StyleSheet } from "react-native";

type MonthDatum = {
  label: string;  // e.g. "2025-01"
  value: number;  // total spending
};

type Props = {
  data: MonthDatum[];
  title: string;
  maxBars?: number;
};

export default function MonthlySpendingChart({ data, title, maxBars = 12 }: Props) {
  const sorted = [...data].sort((a, b) => a.label.localeCompare(b.label)).slice(-maxBars);
  const maxValue = Math.max(1, ...sorted.map((d) => d.value));

  if (sorted.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.empty}>暂无购买数据</Text>
      </View>
    );
  }

  const maxHeight = 120;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.chartArea}>
        <View style={styles.barsRow}>
          {sorted.map((d, i) => {
            const height = Math.max(4, Math.round((d.value / maxValue) * maxHeight));
            return (
              <View key={d.label} style={styles.barCol}>
                <Text style={styles.barValue}>
                  {d.value >= 10000 ? `${(d.value / 10000).toFixed(1)}万` : `¥${d.value}`}
                </Text>
                <View style={[styles.bar, { height, backgroundColor: "#4F46E5" }]} />
                <Text style={styles.barLabel}>
                  {d.label.slice(5)}月
                </Text>
              </View>
            );
          })}
        </View>
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
  title: { fontSize: 15, fontWeight: "700", color: "#111827" },
  empty: { fontSize: 13, color: "#9CA3AF", textAlign: "center", paddingVertical: 24 },
  chartArea: { height: 160, justifyContent: "flex-end" },
  barsRow: { flexDirection: "row", alignItems: "flex-end", gap: 4, justifyContent: "center", flex: 1 },
  barCol: { alignItems: "center", flex: 1, maxWidth: 40, justifyContent: "flex-end" },
  barValue: { fontSize: 9, color: "#9CA3AF", marginBottom: 2 },
  bar: { width: "100%", borderRadius: 3, minHeight: 4, maxWidth: 32 },
  barLabel: { fontSize: 10, color: "#9CA3AF", marginTop: 4 },
});
