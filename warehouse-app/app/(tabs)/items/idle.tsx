import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { itemRepository } from "../../../src/repositories/itemRepository";
import { getReminderSettings } from "../../../src/storage/reminderSettings";
import { ItemSummary } from "../../../src/types";
import ItemCard from "../../../components/ItemCard";
import EmptyState from "../../../components/EmptyState";

export default function IdleItemsPage() {
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    const settings = getReminderSettings();
    const data = await itemRepository.getIdleOverdue(settings.idleReminderDays);
    setItems(data);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetch(); }, []));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>闲置提醒</Text>
        <View style={{ width: 24 }} />
      </View>

      {!loading && items.length === 0 ? (
        <EmptyState
          icon="checkmark-circle-outline"
          title="没有待处理的闲置物品"
          subtitle="所有闲置物品都在提醒天数以内"
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ItemCard item={item} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetch} />}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
          ListHeaderComponent={
            <Text style={styles.hint}>
              以下物品闲置超过 {getReminderSettings().idleReminderDays} 天，按闲置时长排序
            </Text>
          }
        />
      )}
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
  hint: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
});
