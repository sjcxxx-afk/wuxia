import { useState, useCallback, useMemo } from "react";
import {
  View,
  FlatList,
  SectionList,
  RefreshControl,
  TouchableOpacity,
  Text,
  StyleSheet,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { itemRepository } from "../../../lib/repositories/itemRepository";
import { getReminderSettings } from "../../../lib/storage/reminderSettings";
import { ItemSummary } from "../../../lib/types";
import ItemCard from "../../../components/ItemCard";
import EmptyState from "../../../components/EmptyState";
import IdleReminderBanner from "../../../components/IdleReminderBanner";

export default function ItemList() {
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"time" | "category">("time");
  const [menuOpen, setMenuOpen] = useState(false);
  const [idleOverdueCount, setIdleOverdueCount] = useState(0);

  const fetchItems = async () => {
    const data = await itemRepository.list();
    setItems(data);
    const stats = await itemRepository.getStats();
    setIdleOverdueCount(stats.idleOverdue);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchItems();
    }, [])
  );

  // Group items by category for section list
  const sections = useMemo(() => {
    const grouped = new Map<string, ItemSummary[]>();
    for (const item of items) {
      const catName = item.category?.name ?? "未分类";
      if (!grouped.has(catName)) grouped.set(catName, []);
      grouped.get(catName)!.push(item);
    }
    return Array.from(grouped.entries()).map(([title, data]) => ({ title, data }));
  }, [items]);

  const idleThreshold = getReminderSettings().idleReminderDays;

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>我的物品</Text>
      <View style={styles.headerActions}>
        {idleOverdueCount > 0 && (
          <TouchableOpacity
            style={styles.reminderBtn}
            onPress={() => router.push("/(tabs)/items/idle")}
          >
            <Ionicons name="alarm-outline" size={20} color="#D97706" />
            <View style={styles.reminderBadge}>
              <Text style={styles.reminderBadgeText}>{idleOverdueCount}</Text>
            </View>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.importBtn}
          onPress={() => setMenuOpen(!menuOpen)}
        >
          <Ionicons name="cloud-download-outline" size={22} color="#4F46E5" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/(tabs)/items/add")}>
          <Ionicons name="add-circle" size={32} color="#4F46E5" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!loading && items.length === 0) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        {menuOpen && (
          <ImportMenu
            onClose={() => setMenuOpen(false)}
            onOcr={() => { setMenuOpen(false); router.push("/(tabs)/items/ocr-import"); }}
            onFile={() => { setMenuOpen(false); router.push("/(tabs)/items/file-import"); }}
          />
        )}
        <EmptyState
          icon="cube-outline"
          title="还没有物品"
          subtitle="点击右上角 + 添加，或从订单导入"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}

      {menuOpen && (
        <ImportMenu
          onClose={() => setMenuOpen(false)}
          onOcr={() => { setMenuOpen(false); router.push("/(tabs)/items/ocr-import"); }}
          onFile={() => { setMenuOpen(false); router.push("/(tabs)/items/file-import"); }}
        />
      )}

      <IdleReminderBanner count={idleOverdueCount} thresholdDays={idleThreshold} />

      <View style={styles.toggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === "time" && styles.toggleBtnActive]}
          onPress={() => setViewMode("time")}
        >
          <Text style={[styles.toggleText, viewMode === "time" && styles.toggleTextActive]}>
            按时间
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === "category" && styles.toggleBtnActive]}
          onPress={() => setViewMode("category")}
        >
          <Text style={[styles.toggleText, viewMode === "category" && styles.toggleTextActive]}>
            按分类
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === "time" ? (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ItemCard item={item} />}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchItems} />
          }
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ItemCard item={item} />}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{title}</Text>
              <Text style={styles.sectionCount}>{sections.find(s => s.title === title)?.data.length ?? 0} 件</Text>
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchItems} />
          }
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}

function ImportMenu({
  onClose,
  onOcr,
  onFile,
}: {
  onClose: () => void;
  onOcr: () => void;
  onFile: () => void;
}) {
  return (
    <View style={menuStyles.container}>
      <TouchableOpacity style={menuStyles.overlay} onPress={onClose} activeOpacity={1} />
      <View style={menuStyles.menu}>
        <TouchableOpacity style={menuStyles.option} onPress={onOcr}>
          <View style={[menuStyles.iconBox, { backgroundColor: "#EEF2FF" }]}>
            <Ionicons name="scan-outline" size={22} color="#4F46E5" />
          </View>
          <View style={menuStyles.optionText}>
            <Text style={menuStyles.optionTitle}>截图识别</Text>
            <Text style={menuStyles.optionDesc}>上传订单截图，AI 自动识别</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
        </TouchableOpacity>
        <View style={menuStyles.divider} />
        <TouchableOpacity style={menuStyles.option} onPress={onFile}>
          <View style={[menuStyles.iconBox, { backgroundColor: "#F0FDF4" }]}>
            <Ionicons name="document-text-outline" size={22} color="#10B981" />
          </View>
          <View style={menuStyles.optionText}>
            <Text style={menuStyles.optionTitle}>文件导入</Text>
            <Text style={menuStyles.optionDesc}>从 CSV / Excel 批量导入</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const menuStyles = StyleSheet.create({
  container: { position: "relative" },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: -500,
    zIndex: 10,
  },
  menu: {
    position: "absolute",
    top: 4,
    right: 16,
    zIndex: 20,
    width: 260,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  optionDesc: { fontSize: 12, color: "#9CA3AF", marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#F3F4F6", marginHorizontal: 14 },
});

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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reminderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFBEB",
    justifyContent: "center",
    alignItems: "center",
  },
  reminderBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#DC2626",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  reminderBadgeText: { fontSize: 10, fontWeight: "700", color: "#FFFFFF" },
  importBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  toggle: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    borderRadius: 8,
  },
  toggleBtnActive: { backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, boxShadow: "0 1px 2px rgba(0,0,0,0.08)", elevation: 1 },
  toggleText: { fontSize: 14, color: "#9CA3AF", fontWeight: "500" },
  toggleTextActive: { color: "#4F46E5", fontWeight: "600" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionHeaderText: { fontSize: 15, fontWeight: "700", color: "#374151" },
  sectionCount: { fontSize: 13, color: "#9CA3AF" },
});
