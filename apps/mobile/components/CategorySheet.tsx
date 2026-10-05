import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { categoryRepository } from "../lib/repositories/categoryRepository";
import { Category } from "../lib/types";
import { colors } from "../lib/theme";
import Icon from "../components/Icon";

type Props = {
  visible: boolean;
  category?: Category | null;
  onClose: () => void;
  onSaved: () => void;
};

const COLORS = [colors.accent, colors.success, colors.warning, colors.danger, colors.accent, colors.chart[3], colors.chart[2]];
const ICONS = ["📦", "📫", "👔", "👗", "💍", "🎮", "🏃", "🎧", "💪", "🌪", "🎵", "📡"];
const FIELD_TYPES = [
  { key: "text", label: "文本" },
  { key: "number", label: "数字" },
  { key: "date", label: "日期" },
] as const;

type DraftField = { id: string; name: string; type: "text" | "number" | "date"; sortOrder: number };

export default function CategorySheet({ visible, category, onClose, onSaved }: Props) {
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "📦");
  const [color, setColor] = useState(category?.color ?? colors.accent);
  const [loading, setLoading] = useState(false);

  // Custom fields state
  const [customFields, setCustomFields] = useState<DraftField[]>([]);
  const [addingField, setAddingField] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "number" | "date">("text");

  useEffect(() => {
    if (visible) {
      setName(category?.name ?? "");
      setIcon(category?.icon ?? "📦");
      setColor(category?.color ?? colors.accent);
      setCustomFields(
        (category?.customFields ?? []).map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          sortOrder: f.sortOrder,
        }))
      );
    }
  }, [category, visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("提示", "请输入分类名称");
      return;
    }
    setLoading(true);
    if (category) {
      await categoryRepository.update(category.id, {
        name: name.trim(),
        icon,
        color,
        customFields: customFields.map(({ name, type }) => ({ name, type })),
      });
    } else {
      await categoryRepository.create({
        name: name.trim(),
        icon,
        color,
        customFields: customFields.map(({ name, type }) => ({ name, type })),
      });
    }
    setLoading(false);
    onSaved();
    onClose();
  };

  const handleDelete = () => {
    Alert.alert("删除分类", "该分类下的匣物不会被删除，分类将被清空", [
      { text: "取消", style: "cancel" },
      {
        text: "确认删除",
        style: "destructive",
        onPress: async () => {
          await categoryRepository.delete(category!.id);
          onSaved();
          onClose();
        },
      },
    ]);
  };

  const addField = () => {
    if (!newFieldName.trim()) return;
    setCustomFields((prev) => [
      ...prev,
      { id: `draft_${Date.now()}`, name: newFieldName.trim(), type: newFieldType, sortOrder: prev.length },
    ]);
    setNewFieldName("");
    setNewFieldType("text");
    setAddingField(false);
  };

  const removeField = (id: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  };

  const typeLabel = (t: string) => {
    if (t === "text") return "文本";
    if (t === "number") return "数字";
    return "日期";
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior="padding"
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: "100%" }}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
            <View style={styles.header}>
              <Text style={styles.title}>{category ? "编辑分类" : "新建分类"}</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="分类名称"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.sectionLabel}>图标</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {ICONS.map((ic) => (
                  <TouchableOpacity
                    key={ic}
                    style={[styles.iconChip, icon === ic && styles.iconChipActive]}
                    onPress={() => setIcon(ic)}
                  >
                    <Text style={{ fontSize: 22 }}>{ic}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.sectionLabel}>颜色</Text>
            <View style={styles.chipRow}>
              {COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorChip,
                    { backgroundColor: c },
                    color === c && styles.colorChipActive,
                  ]}
                  onPress={() => setColor(c)}
                />
              ))}
            </View>

            {/* Custom Fields */}
            <View style={styles.customFieldsSection}>
              <View style={styles.customFieldsHeader}>
                <Text style={styles.sectionLabel}>自定义字段</Text>
                <TouchableOpacity onPress={() => setAddingField(true)}>
                  <Icon name="plus" size={20} color={colors.accent} />
                </TouchableOpacity>
              </View>

              {customFields.length > 0 && (
                <View style={styles.fieldList}>
                  {customFields.map((f) => (
                    <View key={f.id} style={styles.fieldItem}>
                      <View style={styles.fieldItemInfo}>
                        <Text style={styles.fieldItemName}>{f.name}</Text>
                        <Text style={styles.fieldItemType}>{typeLabel(f.type)}</Text>
                      </View>
                      <TouchableOpacity onPress={() => removeField(f.id)}>
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {addingField && (
                <View style={styles.addFieldRow}>
                  <TextInput
                    style={styles.addFieldInput}
                    value={newFieldName}
                    onChangeText={setNewFieldName}
                    placeholder="字段名"
                    placeholderTextColor={colors.textTertiary}
                    autoFocus
                  />
                  <View style={styles.typeRow}>
                    {FIELD_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t.key}
                        style={[
                          styles.typeBtn,
                          newFieldType === t.key && styles.typeBtnActive,
                        ]}
                        onPress={() => setNewFieldType(t.key)}
                      >
                        <Text
                          style={[
                            styles.typeBtnText,
                            newFieldType === t.key && styles.typeBtnTextActive,
                          ]}
                        >
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.addFieldActions}>
                    <TouchableOpacity onPress={() => setAddingField(false)}>
                      <Text style={styles.addFieldCancel}>取消</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={addField}>
                      <Text style={styles.addFieldConfirm}>添加</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Bottom actions */}
          <View style={styles.actions}>
            {category && (
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={styles.deleteText}>删除</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.saveBtn, loading && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveText}>{loading ? "保存中..." : "保存"}</Text>
            </TouchableOpacity>
          </View>
        </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
    marginBottom: 16,
  },
  sectionLabel: { fontSize: 14, fontWeight: "600", color: colors.textSecondary, marginBottom: 8 },
  chipRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceSunken,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  iconChipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  colorChip: { width: 32, height: 32, borderRadius: 16 },
  colorChipActive: { borderWidth: 3, borderColor: colors.text },
  // Custom Fields
  customFieldsSection: {
    marginTop: 8,
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSunken,
    paddingTop: 12,
  },
  customFieldsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  fieldList: { gap: 6, marginBottom: 12 },
  fieldItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  fieldItemInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fieldItemName: { fontSize: 14, color: colors.text, fontWeight: "500" },
  fieldItemType: {
    fontSize: 11,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  addFieldRow: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  addFieldInput: {
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  typeBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  typeBtnText: { fontSize: 13, color: colors.textSecondary },
  typeBtnTextActive: { color: colors.accent, fontWeight: "600" },
  addFieldActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 4,
  },
  addFieldCancel: { fontSize: 14, color: colors.textSecondary },
  addFieldConfirm: { fontSize: 14, color: colors.accent, fontWeight: "600" },
  // Bottom actions
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 8 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.dangerSoft,
    gap: 6,
  },
  deleteText: { color: colors.danger, fontWeight: "600", fontSize: 15 },
  saveBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.accent,
  },
  saveText: { color: colors.surface, fontWeight: "600", fontSize: 15 },
});
