import { View, StyleSheet } from "react-native";
import { ItemStats } from "../lib/types";
import StatCard from "./StatCard";

type Props = {
  stats: ItemStats;
  onIdlePress?: () => void;
};

export default function StatsRow({ stats, onIdlePress }: Props) {
  return (
    <View style={styles.statsRow}>
      <StatCard label="匣中件数" value={String(stats.total)} color="#4F46E5" />
      <StatCard
        label="闲置中"
        value={String(stats.idle)}
        color={stats.idleOverdue > 0 ? "#D97706" : "#059669"}
        onPress={stats.idleOverdue > 0 ? onIdlePress : undefined}
      />
      <StatCard label="总价值" value={`¥${stats.totalValue}`} color="#7C3AED" />
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 12,
  },
});
