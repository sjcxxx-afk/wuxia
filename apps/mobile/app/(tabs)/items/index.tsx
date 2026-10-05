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
import { colors } from "../../../lib/theme";
import Icon from "../../../components/Icon";

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
      <Text style={styles.headerTitle}>匣中</Text>
      <View style={styles.headerActions}>
        {idleOverdueCount > 0 && (
          <TouchableOpacity
            style={styles.reminderBtn}
            onPress={() => router.push("/(tabs)/items/idle")}
          >
            <Ionicons name="alarm-outline" size={20} color={colors.warning} />
            <View style={styles.reminderBadge}>
              <Text style={styles.reminderBadgeText}>{idleOverdueCount}</Text>
            </View>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.importBtn}
          onPress={() => setMenuOpen(!menuOpen)}
        >
          <Ionicons name="cloud-download-outline" size={22} color={colors.accent} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/(tabs)/items/add")}>
          <Icon name="plus" size={32} color={colors.accent} />
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
          icon="chest"
          title="匣中尚空"
          subtitle="点击右上角 + 入匣，或从订单导入"
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
          <View style={[menuStyles.iconBox, { backgroundColor: colors.accentSoft }]}>
            <Icon name="ocr" size={22} color={colors.accent} />
          </View>
          <View style={menuStyles.optionText}>
            <Text style={menuStyles.optionTitle}>截图识别</Text>
            <Text style={menuStyles.optionDesc}>上传订单截图，AI 自动识别</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        <View style={menuStyles.divider} />
        <TouchableOpacity style={menuStyles.option} onPress={onFile}>
          <View style={[menuStyles.iconBox, { backgroundColor: colors.successSoft }]}>
            <Icon name="file" size={22} color={colors.success} />
          </View>
          <View style={menuStyles.optionText}>
            <Text style={menuStyles.optionTitle}>文件导入</Text>
            <Text style={menuStyles.optionDesc}>从 CSV / Excel 批量导入</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
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
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceSunken,
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
  optionTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  optionDesc: { fontSize: 12, color: colors.textTertiary, marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.surfaceSunken, marginHorizontal: 14 },
});

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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reminderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.warningSoft,
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
    backgroundColor: colors.danger,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  reminderBadgeText: { fontSize: 10, fontWeight: "700", color: colors.surface },
  importBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  toggle: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.surfaceSunken,
    borderRadius: 10,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    borderRadius: 8,
  },
  toggleBtnActive: { backgroundColor: colors.surface, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, boxShadow: "0 1px 2px rgba(0,0,0,0.08)", elevation: 1 },
  toggleText: { fontSize: 14, color: colors.textTertiary, fontWeight: "500" },
  toggleTextActive: { color: colors.accent, fontWeight: "600" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionHeaderText: { fontSize: 15, fontWeight: "700", color: colors.text },
  sectionCount: { fontSize: 13, color: colors.textTertiary },
});
