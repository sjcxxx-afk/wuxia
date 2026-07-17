import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Switch,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getOcrSettings, getOcrSettingsAsync, saveOcrSettings, type OcrSettings } from "../lib/ocr/ocrService";

type AIProvider = "openai" | "deepseek" | "custom";

const AI_PROVIDERS: { key: AIProvider; label: string; apiBase: string; model: string }[] = [
  { key: "openai", label: "OpenAI", apiBase: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { key: "deepseek", label: "DeepSeek", apiBase: "https://api.deepseek.com/v1", model: "deepseek-v4-flash" },
  { key: "custom", label: "自定义", apiBase: "", model: "" },
];

function getProviderFromSettings(s: OcrSettings): AIProvider {
  if (s.apiBase.includes("deepseek")) return "deepseek";
  if (s.apiBase.includes("openai")) return "openai";
  if (!s.apiBase) return "openai";
  return "custom";
}

export default function AiSettingsCard() {
  const [modalVisible, setModalVisible] = useState(false);
  const [provider, setProvider] = useState<AIProvider>(getProviderFromSettings(getOcrSettings()));
  const [apiKey, setApiKey] = useState(getOcrSettings().apiKey);
  const [apiBase, setApiBase] = useState(getOcrSettings().apiBase);
  const [model, setModel] = useState(getOcrSettings().model);
  const [itemReviewEnabled, setItemReviewEnabled] = useState(false);
  const [configured, setConfigured] = useState(false);

  // 挂载时异步加载持久化的 AI 配置
  useEffect(() => {
    getOcrSettingsAsync().then((s) => {
      setItemReviewEnabled(s.itemReviewEnabled);
      if (s.apiKey) {
        setConfigured(true);
        setProvider(getProviderFromSettings(s));
        setApiKey(s.apiKey);
        setApiBase(s.apiBase);
        setModel(s.model);
      }
    });
  }, []);

  const handleSave = async () => {
    await saveOcrSettings({ apiKey, apiBase, model, itemReviewEnabled });
    setConfigured(!!apiKey.trim());
    setModalVisible(false);
  };

  const openModal = async () => {
    const s = await getOcrSettingsAsync();
    setProvider(getProviderFromSettings(s));
    setApiKey(s.apiKey);
    setApiBase(s.apiBase);
    setModel(s.model);
    setItemReviewEnabled(s.itemReviewEnabled);
    setModalVisible(true);
  };

  const selectProvider = (p: AIProvider) => {
    setProvider(p);
    const info = AI_PROVIDERS.find((x) => x.key === p)!;
    if (p !== "custom") {
      setApiBase(info.apiBase);
      setModel(info.model);
    }
  };

  return (
    <>
      {/* OCR Settings Card */}
      <TouchableOpacity style={styles.ocrCard} onPress={openModal}>
        <View style={styles.settingRow}>
          <View style={styles.ocrIconBox}>
            <Ionicons name="sparkles" size={20} color="#4F46E5" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ocrTitle}>截图识别 AI</Text>
            <Text style={styles.ocrDesc}>
              {configured
                ? "本地 OCR + AI 结构化 · 点击修改"
                : "本地 OCR + AI 结构化 · 点击设置"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
        </View>
      </TouchableOpacity>

      {/* AI Settings Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.keyboardAvoiding}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>AI 识别设置</Text>

            <Text style={styles.fieldLabel}>供应商</Text>
            <View style={styles.providerRow}>
              {AI_PROVIDERS.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.providerBtn, provider === p.key && styles.providerBtnActive]}
                  onPress={() => selectProvider(p.key)}
                >
                  <Text
                    style={[
                      styles.providerBtnText,
                      provider === p.key && styles.providerBtnTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>API Key</Text>
            <TextInput
              style={styles.fieldInput}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="sk-..."
              placeholderTextColor="#9CA3AF"
              secureTextEntry
            />

            <Text style={styles.fieldLabel}>API Base</Text>
            <TextInput
              style={styles.fieldInput}
              value={apiBase}
              onChangeText={setApiBase}
              placeholder="https://api.openai.com/v1"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>模型</Text>
            <TextInput
              style={styles.fieldInput}
              value={model}
              onChangeText={setModel}
              placeholder="gpt-4o-mini"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
            />

            <View style={styles.reviewRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>添加后 AI 评价</Text>
                <Text style={styles.reviewHint}>
                  开启后，新建或编辑时会消耗少量 token 生成简短评价
                </Text>
              </View>
              <Switch
                value={itemReviewEnabled}
                onValueChange={setItemReviewEnabled}
                trackColor={{ false: "#E5E7EB", true: "#C7D2FE" }}
                thumbColor={itemReviewEnabled ? "#4F46E5" : "#9CA3AF"}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleSave}>
                <Text style={styles.confirmBtnText}>保存</Text>
              </TouchableOpacity>
            </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  ocrCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ocrIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  ocrTitle: { fontSize: 15, fontWeight: "600", color: "#374151" },
  ocrDesc: { fontSize: 13, color: "#6B7280", lineHeight: 19 },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 32 },
  keyboardAvoiding: { width: "100%", maxHeight: "90%" },
  modalScrollContent: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  modalCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24, width: "100%", maxWidth: 340 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#111827", textAlign: "center", marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 6 },
  providerRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  providerBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center", backgroundColor: "#FFFFFF" },
  providerBtnActive: { borderColor: "#4F46E5", backgroundColor: "#EEF2FF" },
  providerBtnText: { fontSize: 14, color: "#6B7280", fontWeight: "500" },
  providerBtnTextActive: { color: "#4F46E5", fontWeight: "600" },
  fieldInput: {
    height: 44,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#F9FAFB",
    marginBottom: 16,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  reviewHint: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
    lineHeight: 17,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, height: 44, borderRadius: 10, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  cancelBtnText: { fontSize: 15, color: "#6B7280", fontWeight: "600" },
  confirmBtn: { flex: 1, height: 44, borderRadius: 10, backgroundColor: "#4F46E5", justifyContent: "center", alignItems: "center" },
  confirmBtnText: { fontSize: 15, color: "#FFFFFF", fontWeight: "600" },
});
