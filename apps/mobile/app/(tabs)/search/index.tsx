import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { itemRepository } from "../../../lib/repositories/itemRepository";
import { categoryRepository } from "../../../lib/repositories/categoryRepository";
import { ItemSummary } from "../../../lib/types";
import ItemCard from "../../../components/ItemCard";
import SearchBar from "../../../components/SearchBar";
import EmptyState from "../../../components/EmptyState";

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
          <Ionicons name="sparkles" size={18} color="#4F46E5" />
          <Text style={styles.aiBtnText}>AI 问答</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchArea}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="搜索物品名称、品牌、备注..."
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
              icon="search-outline"
              title="没有找到匹配的物品"
              subtitle="试试其他关键词或筛选条件"
            />
          ) : (
            <EmptyState
              icon="search-outline"
              title="搜索你的物品"
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
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#111827" },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
  },
  aiBtnText: { fontSize: 13, fontWeight: "600", color: "#4F46E5" },
  searchArea: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#FFFFFF" },
  filterSection: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9CA3AF",
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
    backgroundColor: "#F3F4F6",
  },
  chipActive: { backgroundColor: "#EEF2FF" },
  chipText: { fontSize: 13, color: "#6B7280" },
  chipTextActive: { color: "#4F46E5", fontWeight: "600" },
});
