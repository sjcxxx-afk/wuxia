import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import DatePickerModal from "./DatePickerModal";
import { categoryRepository } from "../lib/repositories/categoryRepository";
import { resolveImageUri } from "../lib/storage/imageStore";
import type { CustomField } from "../lib/types";
import { colors } from "../lib/theme";

type Category = { id: string; name: string; customFields: CustomField[] };

type ItemValues = {
  name: string;
  categoryId: string;
  brand: string;
  purchaseDate: string;
  purchasePrice: string;
  purchasePlatform: string;
  storeName: string;
  location: string;
  quantity: string;
  status: string;
  notes: string;
};

const PLATFORMS = ["京东", "淘宝", "拼多多", "实体店", "其他"];
const STATUSES = ["使用中", "闲置中", "已损坏", "已出售", "已送人", "收藏中"];

type Props = {
  initial?: Partial<ItemValues>;
  initialImages?: string[];
  initialCustomValues?: Record<string, string>;
  onSave: (
    values: Record<string, string>,
    images: string[],
    customValues: Record<string, string>
  ) => Promise<void>;
  loading?: boolean;
};

export default function ItemForm({
  initial,
  initialImages,
  initialCustomValues,
  onSave,
  loading = false,
}: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState(initial?.name ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate ?? "");
  const [purchasePrice, setPurchasePrice] = useState(initial?.purchasePrice ?? "");
  const [purchasePlatform, setPurchasePlatform] = useState(initial?.purchasePlatform ?? "");
  const [storeName, setStoreName] = useState(initial?.storeName ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [quantity, setQuantity] = useState(initial?.quantity ?? "1");
  const [status, setStatus] = useState(initial?.status ?? "使用中");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // Images
  const [images, setImages] = useState<string[]>(initialImages ?? []);

  // Custom fields
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    initialCustomValues ?? {}
  );

  // Date picker state
  const [showPurchaseDatePicker, setShowPurchaseDatePicker] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState<string | null>(null);

  useEffect(() => {
    categoryRepository.list().then(setCategories);
  }, []);

  // Reset custom values when category changes
  useEffect(() => {
    setCustomValues({});
  }, [categoryId]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const customFields = selectedCategory?.customFields ?? [];

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("权限不足", "请在设置中允许访问相册");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsMultipleSelection: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      const newUris = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...newUris]);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCustomValue = (fieldId: string, value: string) => {
    setCustomValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("提示", "请输入匣物名称");
      return;
    }
    await onSave(
      {
        name: name.trim(),
        categoryId,
        brand: brand.trim(),
        purchaseDate,
        purchasePrice,
        purchasePlatform,
        storeName: storeName.trim(),
        location: location.trim(),
        quantity,
        status,
        notes: notes.trim(),
      },
      images,
      customValues
    );
  };

  const selectGroup = (
    label: string,
    options: string[],
    value: string,
    onChange: (v: string) => void
  ) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, value === opt && styles.chipActive]}
              onPress={() => onChange(value === opt ? "" : opt)}
            >
              <Text style={[styles.chipText, value === opt && styles.chipTextActive]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoiding}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <ScrollView
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.scrollContent}
      >
      {/* Images */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>匣物图片</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.imageRow}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageBox}>
                <Image source={{ uri: resolveImageUri(uri) }} style={styles.thumbnail} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => removeImage(index)}
                >
                  <Ionicons name="close-circle" size={22} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addImageBtn} onPress={pickImages}>
              <Ionicons name="camera-outline" size={28} color={colors.textTertiary} />
              <Text style={styles.addImageText}>添加</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* Name */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>匣物名称 *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="例如：AirPods Pro"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      {/* Category */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>分类</Text>
        {categories.length > 0 ? (
          <View style={styles.chipRow}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, categoryId === cat.id && styles.chipActive]}
                onPress={() => setCategoryId(categoryId === cat.id ? "" : cat.id)}
              >
                <Text style={[styles.chipText, categoryId === cat.id && styles.chipTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>暂无分类，请先到分类 Tab 创建</Text>
        )}
      </View>

      {/* Custom Fields */}
      {customFields.length > 0 && (
        <View style={styles.customFieldsSection}>
          <Text style={styles.customFieldsTitle}>
            {selectedCategory?.name} 的额外信息
          </Text>
          {customFields.map((field) => (
            <View key={field.id} style={styles.fieldGroup}>
              <Text style={styles.label}>{field.name}</Text>
              {field.type === "date" ? (
                <>
                  <TouchableOpacity
                    style={styles.dateBtn}
                    onPress={() => setShowCustomDatePicker(field.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                    <Text
                      style={[
                        styles.dateBtnText,
                        !customValues[field.id] && styles.dateBtnPlaceholder,
                      ]}
                    >
                      {customValues[field.id] || "点击选择日期"}
                    </Text>
                  </TouchableOpacity>
                  <DatePickerModal
                    visible={showCustomDatePicker === field.id}
                    value={customValues[field.id] ?? ""}
                    onConfirm={(d) => {
                      setCustomValues((prev) => ({ ...prev, [field.id]: d }));
                      setShowCustomDatePicker(null);
                    }}
                    onCancel={() => setShowCustomDatePicker(null)}
                  />
                </>
              ) : (
                <TextInput
                  style={styles.input}
                  value={customValues[field.id] ?? ""}
                  onChangeText={(v) => updateCustomValue(field.id, v)}
                  placeholder={
                    field.type === "number"
                      ? "例如：128"
                      : `请输入${field.name}`
                  }
                  placeholderTextColor={colors.textTertiary}
                  keyboardType={
                    field.type === "number" ? "decimal-pad" : "default"
                  }
                />
              )}
            </View>
          ))}
        </View>
      )}

      {/* Brand */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>品牌</Text>
        <TextInput
          style={styles.input}
          value={brand}
          onChangeText={setBrand}
          placeholder="例如：Apple"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.label}>购买价格</Text>
          <TextInput
            style={styles.input}
            value={purchasePrice}
            onChangeText={setPurchasePrice}
            placeholder="¥"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.label}>数量</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            placeholder="1"
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
          />
        </View>
      </View>

      {/* Purchase DateTime — Date+Time Picker */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>购买时间</Text>
        <TouchableOpacity
          style={styles.dateBtn}
          onPress={() => setShowPurchaseDatePicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.dateBtnText, !purchaseDate && styles.dateBtnPlaceholder]}>
            {purchaseDate || "点击选择时间"}
          </Text>
        </TouchableOpacity>
        <DatePickerModal
          visible={showPurchaseDatePicker}
          value={purchaseDate}
          onConfirm={(d) => {
            setPurchaseDate(d);
            setShowPurchaseDatePicker(false);
          }}
          onCancel={() => setShowPurchaseDatePicker(false)}
        />
      </View>

      {selectGroup("购买平台", PLATFORMS, purchasePlatform, setPurchasePlatform)}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>店铺名称</Text>
        <TextInput
          style={styles.input}
          value={storeName}
          onChangeText={setStoreName}
          placeholder="例如：Apple Store 官方旗舰店"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>存放位置</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="例如：卧室衣柜"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      {selectGroup("状态", STATUSES, status, setStatus)}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>备注</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="补充说明..."
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, loading && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={loading}
      >
        <Text style={styles.saveBtnText}>
          {loading ? "保存中..." : initial ? "保存" : "收入物匣"}
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.surface },
  scrollContent: { paddingBottom: 24 },
  fieldGroup: { marginTop: 20, paddingHorizontal: 16 },
  // --- Images ---
  imageRow: { flexDirection: "row", gap: 10 },
  imageBox: { position: "relative" },
  thumbnail: { width: 80, height: 80, borderRadius: 10, backgroundColor: colors.surfaceSunken },
  removeImageBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: colors.surface,
    borderRadius: 11,
  },
  addImageBtn: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    gap: 2,
  },
  addImageText: { fontSize: 11, color: colors.textTertiary },
  // --- Custom Fields ---
  customFieldsSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSunken,
  },
  customFieldsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  // --- Shared ---
  label: { fontSize: 15, fontWeight: "600", color: colors.text, marginBottom: 8 },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  textArea: { height: 80, paddingTop: 12 },
  hint: { fontSize: 13, color: colors.textTertiary, fontStyle: "italic" },
  row: { flexDirection: "row", marginTop: 20, paddingHorizontal: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { fontSize: 14, color: colors.textSecondary },
  chipTextActive: { color: colors.accent, fontWeight: "600" },
  saveBtn: {
    marginHorizontal: 16,
    marginTop: 32,
    height: 50,
    backgroundColor: colors.accent,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnText: { color: colors.surface, fontSize: 17, fontWeight: "600" },
  // --- Date Picker ---
  dateBtn: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.background,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateBtnText: {
    fontSize: 15,
    color: colors.text,
  },
  dateBtnPlaceholder: {
    color: colors.textTertiary,
  },
});
