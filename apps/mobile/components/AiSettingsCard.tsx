import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Switch,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getOcrSettings, getOcrSettingsAsync, grantAiConsent, revokeAiConsent, saveOcrSettings, type OcrSettings, type PersonalityPreset } from "../lib/ocr/ocrService";
import { getItemReviewFailureMessage, testItemReviewConnection } from "../lib/ai/itemReviewService";
import { colors } from "../lib/theme";
import Icon from "../components/Icon";
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
  const [apiKey, setApiKey] = useState("");
  const [apiBase, setApiBase] = useState(getOcrSettings().apiBase);
  const [model, setModel] = useState(getOcrSettings().model);
  const [itemReviewEnabled, setItemReviewEnabled] = useState(false);
  const [personalityPreset, setPersonalityPreset] = useState<PersonalityPreset>("warm");
  const [personalityCustom, setPersonalityCustom] = useState("");
  const [itemReviewFollowPersonality, setItemReviewFollowPersonality] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [consents, setConsents] = useState(getOcrSettings().consents);
  const [testingReview, setTestingReview] = useState(false);

  // 挂载时异步加载持久化的 AI 配置
  useEffect(() => {
    getOcrSettingsAsync().then((s) => {
      setItemReviewEnabled(s.itemReviewEnabled);
      setPersonalityPreset(s.personalityPreset);
      setPersonalityCustom(s.personalityCustom);
      setItemReviewFollowPersonality(s.itemReviewFollowPersonality);
      if (s.hasApiKey) {
        setConfigured(true);
        setProvider(getProviderFromSettings(s));
        setApiBase(s.apiBase);
        setModel(s.model);
      }
      setConsents(s.consents);
    });
  }, []);

  const handleSave = async () => {
    await saveOcrSettings({
      apiBase,
      model,
      itemReviewEnabled,
      personalityPreset,
      personalityCustom: truncateCustomPersonality(personalityCustom),
      itemReviewFollowPersonality,
      consents,
      ...(apiKey.trim() ? { apiKey } : {}),
    });
    setConfigured(configured || !!apiKey.trim());
    setApiKey("");
    setModalVisible(false);
  };

  const openModal = async () => {
    const s = await getOcrSettingsAsync();
    setProvider(getProviderFromSettings(s));
    setApiKey("");
    setApiBase(s.apiBase);
    setModel(s.model);
    setItemReviewEnabled(s.itemReviewEnabled);
    setPersonalityPreset(s.personalityPreset);
    setPersonalityCustom(s.personalityCustom);
    setItemReviewFollowPersonality(s.itemReviewFollowPersonality);
    setConsents(s.consents);
    setModalVisible(true);
  };

  const toggleReview = (enabled: boolean) => {
    if (!enabled) {
      setItemReviewEnabled(enabled);
      return;
    }
    Alert.alert("确认发送 AI 评价数据", "开启后会向当前服务发送单件匣物的名称、分类、价格、状态、品牌、平台和备注，用于生成评价。", [
      { text: "取消", style: "cancel" },
      { text: "同意并开启", onPress: async () => {
        await grantAiConsent("itemReview");
        const updated = await getOcrSettingsAsync();
        setConsents(updated.consents);
        setItemReviewEnabled(true);
      } },
    ]);
  };

  const revokeAllConsents = async () => {
    await revokeAiConsent();
    setConsents({});
  };

  const handleTestReviewConnection = async () => {
    if (testingReview) return;
    setTestingReview(true);
    const outcome = await testItemReviewConnection();
    setTestingReview(false);
    if (outcome.ok) {
      Alert.alert("评价连接正常", `匣灵已在 ${(outcome.durationMs / 1000).toFixed(1)} 秒内完成测试评价。`);
      return;
    }
    const suffix = outcome.status ? `（HTTP ${outcome.status}）` : "";
    Alert.alert("评价连接失败", `${getItemReviewFailureMessage(outcome.code, outcome.status)}${suffix}`);
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
            <Icon name="inkDrop" size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ocrTitle}>AI 配置</Text>
            <Text style={styles.ocrDesc}>
              {configured
                ? "匣灵、截图识别与评价 · 点击修改"
                : "匣灵、截图识别与评价 · 点击设置"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
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
              placeholder={configured ? "已安全保存；输入新 Key 可替换" : "sk-..."}
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
            />
            <Text style={styles.privacyHint}>密钥仅保存在设备安全存储中，不会导出到同步文件。</Text>

            <Text style={styles.fieldLabel}>API Base</Text>
            <TextInput
              style={styles.fieldInput}
              value={apiBase}
              onChangeText={setApiBase}
              placeholder="https://api.openai.com/v1"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>模型</Text>
            <TextInput
              style={styles.fieldInput}
              value={model}
              onChangeText={setModel}
              placeholder="gpt-4o-mini"
              placeholderTextColor={colors.textTertiary}
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
                  placeholderTextColor={colors.textTertiary}
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
                onValueChange={toggleReview}
                trackColor={{ false: colors.border, true: colors.accentSoft }}
                thumbColor={itemReviewEnabled ? colors.accent : colors.textTertiary}
              />
            </View>

            <Text style={styles.privacyHint}>OCR 会发送本地提取的订单文字；匣灵会发送经过本地筛选的物品字段。首次使用时会再次确认。</Text>
            <TouchableOpacity
              style={[styles.testBtn, testingReview && styles.testBtnDisabled]}
              disabled={testingReview}
              onPress={handleTestReviewConnection}
            >
              <Ionicons name="pulse-outline" size={16} color={colors.accent} />
              <Text style={styles.testBtnText}>{testingReview ? "正在测试评价连接…" : "测试评价连接"}</Text>
            </TouchableOpacity>
            <Text style={styles.testHint}>使用已保存的配置发送固定测试文本，不会上传匣物数据。</Text>
            {Object.keys(consents).length > 0 && <TouchableOpacity onPress={revokeAllConsents}><Text style={styles.revokeText}>撤回全部 AI 数据授权</Text></TouchableOpacity>}

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
                trackColor={{ false: colors.border, true: colors.accentSoft }}
                thumbColor={itemReviewFollowPersonality ? colors.accent : colors.textTertiary}
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
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceSunken,
  },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ocrIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  ocrTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  ocrDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 32 },
  keyboardAvoiding: { width: "100%", maxHeight: "90%" },
  modalScrollContent: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  modalCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: "100%", maxWidth: 340 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: colors.text, textAlign: "center", marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 6 },
  providerRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  providerBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: "center", backgroundColor: colors.surface },
  providerBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  providerBtnText: { fontSize: 14, color: colors.textSecondary, fontWeight: "500" },
  providerBtnTextActive: { color: colors.accent, fontWeight: "600" },
  personalityRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  personalityBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  personalityBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  personalityBtnText: { fontSize: 13, color: colors.textSecondary, fontWeight: "500" },
  personalityBtnTextActive: { color: colors.accent, fontWeight: "600" },
  customPersonalityInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
    textAlignVertical: "top",
  },
  customHint: { fontSize: 12, color: colors.textTertiary, textAlign: "right", marginTop: -8, marginBottom: 16 },
  fieldInput: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
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
    color: colors.textTertiary,
    marginTop: 4,
    lineHeight: 17,
  },
  privacyHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: -8, marginBottom: 16 },
  testBtn: {
    height: 40,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accentSoft,
    backgroundColor: colors.accentSoft,
    marginTop: -4,
  },
  testBtnDisabled: { opacity: 0.6 },
  testBtnText: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  testHint: { fontSize: 11, color: colors.textSecondary, lineHeight: 16, marginTop: 6, marginBottom: 16 },
  revokeText: { fontSize: 13, color: colors.danger, fontWeight: "600", marginBottom: 16 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, height: 44, borderRadius: 10, backgroundColor: colors.surfaceSunken, justifyContent: "center", alignItems: "center" },
  cancelBtnText: { fontSize: 15, color: colors.textSecondary, fontWeight: "600" },
  confirmBtn: { flex: 1, height: 44, borderRadius: 10, backgroundColor: colors.accent, justifyContent: "center", alignItems: "center" },
  confirmBtnText: { fontSize: 15, color: colors.surface, fontWeight: "600" },
});
