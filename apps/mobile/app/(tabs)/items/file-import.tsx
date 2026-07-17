import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { importFile, ImportRow } from "../../../lib/ocr/fileImportService";
import { itemRepository } from "../../../lib/repositories/itemRepository";

export default function FileImport() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setFileName(file.name);
      setLoading(true);
      setRows([]);
      setSelected(new Set());

      try {
        const parsed = await importFile(file.uri, file.name);
        setRows(parsed);
        // 默认全选
        setSelected(new Set(parsed.map((_, i) => i)));
      } catch (err: any) {
        Alert.alert("解析失败", err.message || "无法解析文件");
        setFileName(null);
      }
    } catch (err: any) {
      Alert.alert("选择文件失败", err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (index: number) => {
    const next = new Set(selected);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((_, i) => i)));
    }
  };

  const handleImport = async () => {
    if (selected.size === 0) {
      Alert.alert("提示", "请至少选择一条记录");
      return;
    }
    setSaving(true);
    try {
      let imported = 0;
      for (const idx of selected) {
        const row = rows[idx];
        await itemRepository.create({
          name: row.name,
          categoryId: null,
          brand: row.brand || null,
          purchaseDate: row.purchaseDate || null,
          purchasePrice: row.purchasePrice || null,
          purchasePlatform: row.purchasePlatform || null,
          storeName: row.storeName || null,
          location: null,
          quantity: row.quantity || 1,
          status: "使用中",
          notes: null,
            images: [],
            customValues: {},
          });
        imported++;
      }
      Alert.alert("导入完成", `成功入匣 ${imported} 件`, [
        { text: "返回列表", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("导入失败", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>批量导入</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* 选文件区域 */}
        <TouchableOpacity style={styles.pickArea} onPress={pickFile}>
          <Ionicons name="document-text-outline" size={48} color="#4F46E5" />
          <Text style={styles.pickTitle}>
            {fileName ? fileName : "点击选择文件"}
          </Text>
          <Text style={styles.pickSubtitle}>
            支持淘宝/京东/拼多多导出的 CSV 或 Excel 文件
          </Text>
          {fileName && (
            <Text style={styles.changeFileText}>点击更换文件</Text>
          )}
        </TouchableOpacity>

        {/* 加载状态 */}
        {loading && (
          <View style={styles.loadingArea}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>正在解析文件...</Text>
          </View>
        )}

        {/* 解析结果 */}
        {rows.length > 0 && (
          <View style={styles.resultSection}>
            {/* 工具栏 */}
            <View style={styles.toolbar}>
              <Text style={styles.toolbarTitle}>
                识别到 <Text style={{ fontWeight: "700" }}>{rows.length}</Text> 条记录
              </Text>
              <TouchableOpacity onPress={toggleAll}>
                <Text style={styles.toggleAllText}>
                  {selected.size === rows.length ? "取消全选" : "全选"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 记录列表 */}
            {rows.map((row, index) => {
              const isSelected = selected.has(index);
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.rowCard, isSelected && styles.rowCardSelected]}
                  onPress={() => toggleSelect(index)}
                  activeOpacity={0.7}
                >
                  <View style={styles.checkbox}>
                    {isSelected ? (
                      <Ionicons name="checkbox" size={22} color="#4F46E5" />
                    ) : (
                      <Ionicons name="square-outline" size={22} color="#D1D5DB" />
                    )}
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName} numberOfLines={2}>
                      {row.name}
                    </Text>
                    <View style={styles.rowMeta}>
                      {row.purchasePrice > 0 && (
                        <Text style={styles.rowPrice}>¥{row.purchasePrice}</Text>
                      )}
                      {row.purchasePlatform ? (
                        <Text style={styles.rowPlatform}>{row.purchasePlatform}</Text>
                      ) : null}
                      {row.purchaseDate ? (
                        <Text style={styles.rowDate}>{row.purchaseDate}</Text>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* 导入按钮 */}
            <TouchableOpacity
              style={[styles.importBtn, saving && { opacity: 0.6 }]}
              onPress={handleImport}
              disabled={saving}
            >
              <Text style={styles.importBtnText}>
                {saving ? "导入中..." : `导入选中 (${selected.size} 条)`}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTitle: { fontSize: 17, fontWeight: "600", color: "#111827" },
  body: { flex: 1 },
  bodyContent: { padding: 16 },

  // 选文件区域
  pickArea: {
    paddingVertical: 32,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    gap: 6,
  },
  pickTitle: { fontSize: 16, fontWeight: "600", color: "#374151", marginTop: 4 },
  pickSubtitle: { fontSize: 13, color: "#9CA3AF", marginTop: 2 },
  changeFileText: { fontSize: 13, color: "#4F46E5", marginTop: 4 },

  // 加载
  loadingArea: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: { fontSize: 14, color: "#6B7280" },

  // 结果区域
  resultSection: { marginTop: 16 },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  toolbarTitle: { fontSize: 15, color: "#374151" },
  toggleAllText: { fontSize: 14, color: "#4F46E5", fontWeight: "500" },

  // 记录卡片
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    backgroundColor: "#FAFAFA",
  },
  rowCardSelected: {
    borderColor: "#C7D2FE",
    backgroundColor: "#EEF2FF",
  },
  checkbox: { marginRight: 10 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: "500", color: "#111827", marginBottom: 4 },
  rowMeta: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  rowPrice: { fontSize: 13, color: "#EF4444", fontWeight: "600" },
  rowPlatform: {
    fontSize: 12,
    color: "#4F46E5",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  rowDate: { fontSize: 12, color: "#9CA3AF" },

  // 导入按钮
  importBtn: {
    marginTop: 16,
    height: 50,
    backgroundColor: "#10B981",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  importBtnText: { color: "#FFFFFF", fontSize: 17, fontWeight: "600" },
});
