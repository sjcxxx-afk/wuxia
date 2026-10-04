import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { itemRepository } from "../../../lib/repositories/itemRepository";
import { categoryRepository } from "../../../lib/repositories/categoryRepository";
import { loadData } from "../../../lib/storage/jsonStore";
import CategoryBarChart from "../../../components/CategoryBarChart";
import MonthlySpendingChart from "../../../components/MonthlySpendingChart";
import { colors } from "../../../lib/theme";

export default function StatsPage() {
  const [categoryData, setCategoryData] = useState<{ label: string; value: number; icon: string; color: string }[]>([]);
  const [platformData, setPlatformData] = useState<{ label: string; value: number; color?: string }[]>([]);
  const [statusData, setStatusData] = useState<{ label: string; value: number; color?: string }[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ label: string; value: number }[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalValue, setTotalValue] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const data = await loadData();
      const cats = await categoryRepository.list();

      // Category distribution
      const catCounts = new Map<string, { count: number; icon: string; color: string }>();
      for (const c of cats) {
        catCounts.set(c.id, { count: 0, icon: c.icon ?? "📦", color: c.color ?? colors.accent });
      }
      let uncategorized = 0;
      for (const item of data.items) {
        if (item.categoryId && catCounts.has(item.categoryId)) {
          catCounts.get(item.categoryId)!.count++;
        } else {
          uncategorized++;
        }
      }
      const catArr = Array.from(catCounts.entries())
        .map(([id, info]) => ({
          label: cats.find((c) => c.id === id)?.name ?? "未知",
          value: info.count,
          icon: info.icon,
          color: info.color,
        }))
        .filter((d) => d.value > 0);
      if (uncategorized > 0) {
        catArr.push({ label: "未分类", value: uncategorized, icon: "📦", color: colors.textTertiary });
      }
      setCategoryData(catArr);

      // Platform distribution
      const platMap = new Map<string, number>();
      for (const item of data.items) {
        const p = item.purchasePlatform || "未填写";
        platMap.set(p, (platMap.get(p) ?? 0) + 1);
      }
      setPlatformData(
        Array.from(platMap.entries()).map(([label, value]) => ({ label, value }))
      );

      // Status distribution
      const statusColorMap: Record<string, string> = {
        "使用中": colors.success,
        "闲置中": colors.warning,
        "已损坏": colors.danger,
        "已出售": colors.accent,
        "已送人": colors.accent,
        "收藏中": colors.chart[3],
      };
      const statusMap = new Map<string, number>();
      for (const item of data.items) {
        const s = item.status || "未知";
        statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
      }
      setStatusData(
        Array.from(statusMap.entries()).map(([label, value]) => ({
          label,
          value,
          color: statusColorMap[label] ?? colors.textTertiary,
        }))
      );

      // Monthly spending
      const monthMap = new Map<string, number>();
      for (const item of data.items) {
        if (item.purchaseDate && item.purchasePrice) {
          const month = String(item.purchaseDate).slice(0, 7); // YYYY-MM
          monthMap.set(month, (monthMap.get(month) ?? 0) + item.purchasePrice);
        }
      }
      const months = Array.from(monthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12)
        .map(([label, value]) => ({ label, value: Math.round(value) }));
      setMonthlyData(months);

      setTotalItems(data.items.length);
      const tv = data.items.reduce((sum, item) => sum + (item.purchasePrice ?? 0), 0);
      setTotalValue(tv);
    };
    fetch();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>物匣统计</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalItems}</Text>
            <Text style={styles.summaryLabel}>匣中件数</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>¥{totalValue}</Text>
            <Text style={styles.summaryLabel}>总价值</Text>
          </View>
        </View>

        {/* Monthly Spending */}
        <MonthlySpendingChart data={monthlyData} title="月度消费趋势" />

        {/* Category Distribution */}
        <CategoryBarChart data={categoryData} title="分类分布" />

        {/* Platform Distribution */}
        <CategoryBarChart
          data={platformData.map((d, i) => ({
            ...d,
            color: [colors.accent, colors.warning, colors.danger, colors.success, colors.accent, colors.chart[3], colors.chart[2]][i % 7],
          }))}
          title="购买平台分布"
          maxBars={6}
        />

        {/* Status Distribution */}
        <CategoryBarChart data={statusData} title="匣物状态分布" />

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSunken,
  },
  headerTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.surfaceSunken,
  },
  summaryValue: { fontSize: 22, fontWeight: "700", color: colors.text },
  summaryLabel: { fontSize: 12, color: colors.textTertiary, marginTop: 4 },
});
