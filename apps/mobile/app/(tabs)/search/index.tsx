import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { itemRepository } from "../../../lib/repositories/itemRepository";
import { categoryRepository } from "../../../lib/repositories/categoryRepository";
import { ItemSummary } from "../../../lib/types";
import ItemCard from "../../../components/ItemCard";
import SearchBar from "../../../components/SearchBar";
import EmptyState from "../../../components/EmptyState";
import { colors } from "../../../lib/theme";
import Icon from "../../../components/Icon";

type Category = { id: string; name: string };

const STATUSES = ["使用中", "闲置中", "已损坏", "已出售", "已送人", "收藏中"];

export default function Search() {
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [results, setResults] = useState<ItemSummary[]>([]);
  const [hasCriteria, setHasCriteria] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    categoryRepository.list().then((data) => {
      setCategories(data.map((c) => ({ id: c.id, name: c.name })));
    });
  }, []);

  // Auto-search whenever filters change (with debounce for text)
  useEffect(() => {
    const hasAny = !!query.trim() || !!selectedCategory || !!selectedStatus;
    setHasCriteria(hasAny);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!hasAny) {
        setResults([]);
        return;
      }
      const data = await itemRepository.search(query.trim(), {
        categoryId: selectedCategory,
        status: selectedStatus,
      });
      setResults(data);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedCategory, selectedStatus]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>搜索</Text>
        <TouchableOpacity
          style={styles.aiBtn}
          onPress={() => router.push("/(tabs)/search/qa")}
        >
          <Icon name="inkDrop" size={18} color={colors.accent} />
          <Text style={styles.aiBtnText}>匣灵</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchArea}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="寻觅匣物名称、品牌、备注..."
        />
      </View>

      {/* 分类筛选 */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>分类</Text>
        <View style={styles.chipWrap}>
          <TouchableOpacity
            style={[styles.chip, !selectedCategory && styles.chipActive]}
            onPress={() => setSelectedCategory("")}
          >
            <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>全部</Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, selectedCategory === cat.id && styles.chipActive]}
              onPress={() => setSelectedCategory(selectedCategory === cat.id ? "" : cat.id)}
            >
              <Text style={[styles.chipText, selectedCategory === cat.id && styles.chipTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 状态筛选 */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>状态</Text>
        <View style={styles.chipWrap}>
          <TouchableOpacity
            style={[styles.chip, !selectedStatus && styles.chipActive]}
            onPress={() => setSelectedStatus("")}
          >
            <Text style={[styles.chipText, !selectedStatus && styles.chipTextActive]}>全部</Text>
          </TouchableOpacity>
          {STATUSES.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, selectedStatus === s && styles.chipActive]}
              onPress={() => setSelectedStatus(selectedStatus === s ? "" : s)}
            >
              <Text style={[styles.chipText, selectedStatus === s && styles.chipTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 结果 */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ItemCard item={item} />}
        ListEmptyComponent={
          hasCriteria ? (
            <EmptyState
              icon="search"
              title="匣中未觅得匹配"
              subtitle="试试其他关键词或筛选条件"
            />
          ) : (
            <EmptyState
              icon="search"
              title="寻觅匣中之物"
              subtitle="输入关键词或选择筛选条件即可实时搜索"
            />
          )
        }
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
      />
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
  headerTitle: { fontSize: 22, fontWeight: "700", color: colors.text },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
  },
  aiBtnText: { fontSize: 13, fontWeight: "600", color: colors.accent },
  searchArea: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface },
  filterSection: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSunken,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textTertiary,
    marginBottom: 8,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceSunken,
  },
  chipActive: { backgroundColor: colors.accentSoft },
  chipText: { fontSize: 13, color: colors.textSecondary },
  chipTextActive: { color: colors.accent, fontWeight: "600" },
});
