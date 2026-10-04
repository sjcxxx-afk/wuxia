import { View, StyleSheet } from "react-native";
import { ItemStats } from "../lib/types";
import StatCard from "./StatCard";
import { colors } from "../lib/theme";

type Props = {
  stats: ItemStats;
  onIdlePress?: () => void;
};

export default function StatsRow({ stats, onIdlePress }: Props) {
  return (
    <View style={styles.statsRow}>
      <StatCard label="匣中件数" value={String(stats.total)} color={colors.accent} />
      <StatCard
        label="闲置中"
        value={String(stats.idle)}
        color={stats.idleOverdue > 0 ? colors.warning : colors.success}
        onPress={stats.idleOverdue > 0 ? onIdlePress : undefined}
      />
      <StatCard label="总价值" value={`¥${stats.totalValue}`} color={colors.accent} />
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
