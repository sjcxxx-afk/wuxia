import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { categoryRepository } from "../../../lib/repositories/categoryRepository";
import { Category } from "../../../lib/types";
import CategorySheet from "../../../components/CategorySheet";
import EmptyState from "../../../components/EmptyState";

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const fetchCategories = async () => {
    const data = await categoryRepository.list();
    setCategories(data);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
    }, [])
  );

  const openAdd = () => {
    setEditingCategory(null);
    setSheetVisible(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCategory(cat);
    setSheetVisible(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>分类管理</Text>
        <TouchableOpacity onPress={openAdd}>
          <Ionicons name="add-circle" size={32} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {!loading && categories.length === 0 ? (
        <EmptyState
          icon="grid-outline"
          title="还没有分类"
          subtitle="点击右上角 + 创建第一个分类"
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.grid}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchCategories} />
          }
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.card, { borderLeftColor: cat.color ?? "#4F46E5", borderLeftWidth: 4 }]}
              onPress={() => router.push(`/(tabs)/categories/${cat.id}`)}
              onLongPress={() => openEdit(cat)}
            >
              <Text style={styles.icon}>{cat.icon ?? "📦"}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <CategorySheet
        visible={sheetVisible}
        category={editingCategory}
        onClose={() => setSheetVisible(false)}
        onSaved={fetchCategories}
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    paddingBottom: 24,
  },
  card: {
    width: "46%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    margin: "2%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  icon: { fontSize: 32, marginBottom: 8 },
  name: { fontSize: 14, fontWeight: "600", color: "#374151", textAlign: "center" },
});