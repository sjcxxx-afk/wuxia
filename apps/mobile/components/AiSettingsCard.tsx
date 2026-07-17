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
import { getOcrSettings, getOcrSettingsAsync, saveOcrSettings, type OcrSettings, type PersonalityPreset } from "../lib/ocr/ocrService";
import {
  PERSONALITY_CUSTOM_LABEL,
  PERSONALITY_LABELS,
  truncateCustomPersonality,
} from "../lib/ai/personality";

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

const PERSONALITY_OPTIONS: { key: PersonalityPreset; label: string }[] = [
  { key: "warm", label: PERSONALITY_LABELS.warm },
  { key: "reliable", label: PERSONALITY_LABELS.reliable },
  { key: "cool", label: PERSONALITY_LABELS.cool },
  { key: "custom", label: PERSONALITY_CUSTOM_LABEL },
];

export default function AiSettingsCard() {
  const [modalVisible, setModalVisible] = useState(false);
  const [provider, setProvider] = useState<AIProvider>(getProviderFromSettings(getOcrSettings()));
  const [apiKey, setApiKey] = useState(getOcrSettings().apiKey);
  const [apiBase, setApiBase] = useState(getOcrSettings().apiBase);
  const [model, setModel] = useState(getOcrSettings().model);
  const [itemReviewEnabled, setItemReviewEnabled] = useState(false);
  const [personalityPreset, setPersonalityPreset] = useState<PersonalityPreset>("warm");
  const [personalityCustom, setPersonalityCustom] = useState("");
  const [itemReviewFollowPersonality, setItemReviewFollowPersonality] = useState(true);
  const [configured, setConfigured] = useState(false);

  // 挂载时异步加载持久化的 AI 配置
  useEffect(() => {
    getOcrSettingsAsync().then((s) => {
      setItemReviewEnabled(s.itemReviewEnabled);
      setPersonalityPreset(s.personalityPreset);
      setPersonalityCustom(s.personalityCustom);
      setItemReviewFollowPersonality(s.itemReviewFollowPersonality);
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
    await saveOcrSettings({
      apiKey,
      apiBase,
      model,
      itemReviewEnabled,
      personalityPreset,
      personalityCustom: truncateCustomPersonality(personalityCustom),
      itemReviewFollowPersonality,
    });
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
    setPersonalityPreset(s.personalityPreset);
    setPersonalityCustom(s.personalityCustom);
    setItemReviewFollowPersonality(s.itemReviewFollowPersonality);
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
            <Text style={styles.ocrTitle}>AI 配置</Text>
            <Text style={styles.ocrDesc}>
              {configured
                ? "匣灵、截图识别与评价 · 点击修改"
                : "匣灵、截图识别与评价 · 点击设置"}
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
                <Text style={styles.modalTitle}>AI 配置</Text>

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

            <Text style={styles.fieldLabel}>匣灵性格</Text>
            <View style={styles.personalityRow}>
              {PERSONALITY_OPTIONS.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.personalityBtn,
                    personalityPreset === p.key && styles.personalityBtnActive,
                  ]}
                  onPress={() => setPersonalityPreset(p.key)}
                >
                  <Text
                    style={[
                      styles.personalityBtnText,
                      personalityPreset === p.key && styles.personalityBtnTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {personalityPreset === "custom" && (
              <>
                <Text style={styles.fieldLabel}>自定义性格</Text>
                <TextInput
                  style={styles.customPersonalityInput}
                  value={personalityCustom}
                  onChangeText={setPersonalityCustom}
                  placeholder="像管家一样称呼我为匣主…"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={200}
                />
                <Text style={styles.customHint}>{personalityCustom.length}/200</Text>
              </>
            )}

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

            <View style={styles.reviewRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>评价跟随匣灵性格</Text>
                <Text style={styles.reviewHint}>
                  关闭后，匣物评价保持客观简短，不受性格影响
                </Text>
              </View>
              <Switch
                value={itemReviewFollowPersonality}
                onValueChange={setItemReviewFollowPersonality}
                trackColor={{ false: "#E5E7EB", true: "#C7D2FE" }}
                thumbColor={itemReviewFollowPersonality ? "#4F46E5" : "#9CA3AF"}
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
  personalityRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  personalityBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  personalityBtnActive: { borderColor: "#4F46E5", backgroundColor: "#EEF2FF" },
  personalityBtnText: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  personalityBtnTextActive: { color: "#4F46E5", fontWeight: "600" },
  customPersonalityInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#F9FAFB",
    textAlignVertical: "top",
  },
  customHint: { fontSize: 12, color: "#9CA3AF", textAlign: "right", marginTop: -8, marginBottom: 16 },
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
