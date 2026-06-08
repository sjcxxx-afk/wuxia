import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { recognizeOrderScreenshot, OcrResult } from "../../../src/ocr/ocrService";
import { itemRepository } from "../../../src/repositories/itemRepository";

export default function OcrImport() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [editing, setEditing] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("权限不足", "请在设置中允许访问相册");
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      base64: true,
    });

    if (!pickerResult.canceled && pickerResult.assets[0]) {
      const asset = pickerResult.assets[0];
      setImageUri(asset.uri);
      setImageBase64(asset.base64 ?? null);
      setResult(null);
      setEditing(false);
    }
  };

  const handleRecognize = async () => {
    if (!imageBase64) {
      Alert.alert("提示", "请先选择图片");
      return;
    }
    setLoading(true);
    try {
      const mimeType = imageUri?.endsWith(".png") ? "image/png" : "image/jpeg";
      const ocrResult = await recognizeOrderScreenshot(imageBase64, mimeType);
      setResult(ocrResult);
    } catch (err: any) {
      Alert.alert("识别失败", err.message || "未知错误");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await itemRepository.create({
        name: result.name,
        categoryId: null,
        brand: result.brand || null,
        purchaseDate: result.purchaseDate || null,
        purchasePrice: result.purchasePrice || null,
        purchasePlatform: result.purchasePlatform || null,
        storeName: result.storeName || null,
        location: null,
        quantity: result.quantity || 1,
        status: "使用中",
        notes: null,
            images: [],
            customValues: {},
          });
      Alert.alert("导入成功", `已添加「${result.name}」`, [
        { text: "继续识别", style: "cancel" },
        { text: "返回列表", onPress: () => router.back() },
      ]);
      setImageUri(null);
      setImageBase64(null);
      setResult(null);
    } catch (err: any) {
      Alert.alert("保存失败", err.message);
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
        <Text style={styles.headerTitle}>截图导入</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* 选图区域 */}
        {!imageUri ? (
          <TouchableOpacity style={styles.pickArea} onPress={pickImage}>
            <Ionicons name="scan-outline" size={56} color="#4F46E5" />
            <Text style={styles.pickTitle}>点击选择订单截图</Text>
            <Text style={styles.pickSubtitle}>
              支持淘宝、京东、拼多多等平台订单截图
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            {/* 图片预览 + 重新选择 */}
            <View style={styles.imageSection}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
              <TouchableOpacity style={styles.changeImageBtn} onPress={pickImage}>
                <Ionicons name="swap-horizontal" size={16} color="#4F46E5" />
                <Text style={styles.changeImageText}>换一张</Text>
              </TouchableOpacity>
            </View>

            {/* 识别按钮 */}
            {!result && (
              <TouchableOpacity
                style={[styles.recognizeBtn, loading && { opacity: 0.6 }]}
                onPress={handleRecognize}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={20} color="#FFFFFF" />
                    <Text style={styles.recognizeBtnText}>AI 识别订单信息</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* 识别结果预览 */}
            {result && (
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.resultTitle}>识别结果</Text>
                  <TouchableOpacity onPress={() => setEditing(!editing)}>
                    <Text style={styles.editToggle}>
                      {editing ? "收起" : "编辑"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {editing ? (
                  <>
                    <FieldEditor label="商品名称" value={result.name} onChange={(v) => setResult({ ...result, name: v })} />
                    <FieldEditor label="品牌" value={result.brand} onChange={(v) => setResult({ ...result, brand: v })} />
                    <FieldEditor label="价格" value={String(result.purchasePrice || "")} onChange={(v) => setResult({ ...result, purchasePrice: parseFloat(v) || 0 })} keyboardType="decimal-pad" />
                    <FieldEditor label="平台" value={result.purchasePlatform} onChange={(v) => setResult({ ...result, purchasePlatform: v })} />
                    <FieldEditor label="店铺" value={result.storeName} onChange={(v) => setResult({ ...result, storeName: v })} />
                    <FieldEditor label="购买日期" value={result.purchaseDate} onChange={(v) => setResult({ ...result, purchaseDate: v })} placeholder="YYYY-MM-DD" />
                    <FieldEditor label="数量" value={String(result.quantity)} onChange={(v) => setResult({ ...result, quantity: parseInt(v) || 1 })} keyboardType="number-pad" />
                  </>
                ) : (
                  <>
                    <ResultRow label="商品名称" value={result.name} />
                    {result.brand ? <ResultRow label="品牌" value={result.brand} /> : null}
                    <ResultRow label="价格" value={`¥${result.purchasePrice}`} />
                    <ResultRow label="平台" value={result.purchasePlatform} />
                    {result.storeName ? <ResultRow label="店铺" value={result.storeName} /> : null}
                    {result.purchaseDate ? <ResultRow label="购买日期" value={result.purchaseDate} /> : null}
                    <ResultRow label="数量" value={`${result.quantity} 件`} />
                  </>
                )}

                <View style={styles.resultActions}>
                  <TouchableOpacity style={styles.retryBtn} onPress={() => { setResult(null); setEditing(false); }}>
                    <Text style={styles.retryBtnText}>重新识别</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    <Text style={styles.saveBtnText}>
                      {saving ? "保存中..." : "确认导入"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function FieldEditor({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
}) {
  return (
    <View style={styles.fieldEditor}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
      />
    </View>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue} numberOfLines={1}>{value}</Text>
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

  // 选图区域
  pickArea: {
    height: 240,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    gap: 8,
  },
  pickTitle: { fontSize: 16, fontWeight: "600", color: "#374151", marginTop: 4 },
  pickSubtitle: { fontSize: 13, color: "#9CA3AF", marginTop: 2 },

  // 图片预览
  imageSection: { alignItems: "center" },
  previewImage: {
    width: "100%",
    height: 320,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  changeImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  changeImageText: { fontSize: 14, color: "#4F46E5", fontWeight: "500" },

  // 识别按钮
  recognizeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    height: 50,
    backgroundColor: "#4F46E5",
    borderRadius: 12,
  },
  recognizeBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },

  // 识别结果
  resultCard: {
    marginTop: 16,
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    padding: 16,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  resultTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#065F46",
  },
  editToggle: { fontSize: 14, color: "#4F46E5", fontWeight: "500" },

  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D1FAE5",
  },
  resultLabel: { fontSize: 14, color: "#6B7280", flex: 1 },
  resultValue: { fontSize: 14, color: "#111827", fontWeight: "500", flex: 2, textAlign: "right" },

  // 编辑模式
  fieldEditor: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  fieldLabel: { fontSize: 14, color: "#6B7280", width: 72 },
  fieldInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },

  // 操作按钮
  resultActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  retryBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
  },
  retryBtnText: { fontSize: 15, color: "#6B7280", fontWeight: "500" },
  saveBtn: {
    flex: 1,
    height: 42,
    backgroundColor: "#10B981",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnText: { fontSize: 15, color: "#FFFFFF", fontWeight: "600" },
});
