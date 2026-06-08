import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { itemRepository } from "../../../src/repositories/itemRepository";
import { ItemSummary } from "../../../src/types";
import ItemCard from "../../../components/ItemCard";
import EmptyState from "../../../components/EmptyState";

export default function CategoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<ItemSummary[]>([]);

  useEffect(() => {
    if (!id) return;
    itemRepository.listByCategory(id).then((data) => {
      if (data) setItems(data);
    });
  }, [id]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/categories")}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>分类</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.count}>{items.length} 件物品</Text>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ItemCard item={item} />}
        ListEmptyComponent={
          <EmptyState title="此分类下暂无物品" />
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
  headerTitle: { fontSize: 17, fontWeight: "600", color: "#111827" },
  count: { fontSize: 14, color: "#9CA3AF", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
});