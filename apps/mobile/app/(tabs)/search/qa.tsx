import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Image,
  Keyboard,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { askQuestion, QaMessage } from "../../../lib/ai/qaService";
import { getPersonalityLabel } from "../../../lib/ai/personality";
import { getOcrSettingsAsync, grantAiConsent, hasAiConsent } from "../../../lib/ocr/ocrService";
import type { PersonalityPreset } from "../../../lib/ocr/ocrService";
import { colors } from "../../../lib/theme";

const PRESETS = [
  { icon: "📊", label: "物匣概览", question: "给我一个物匣概览，包括总数、总价值和分类分布" },
  { icon: "💤", label: "有哪些闲置匣物", question: "列出所有闲置中的匣物" },
  { icon: "💰", label: "哪个平台花最多", question: "我在各平台分别花了多少钱？哪个平台花最多？" },
  { icon: "🆕", label: "最近买了什么", question: "我最近买的5件匣物是什么？" },
  { icon: "💎", label: "最贵的是哪些", question: "最贵的5件匣物是什么？" },
  { icon: "🏪", label: "京东买了什么", question: "我在京东上买了哪些东西？" },
];

export default function QaPage() {
  const [messages, setMessages] = useState<QaMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [personalityPreset, setPersonalityPreset] = useState<PersonalityPreset>("warm");
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getOcrSettingsAsync().then((s) => {
      setPersonalityPreset(s.personalityPreset);
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // edge-to-edge: keyboard height often includes the nav bar inset
  const bottomPad =
    keyboardHeight > 0
      ? Math.max(0, keyboardHeight - insets.bottom)
      : insets.bottom;

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;

    const settings = await getOcrSettingsAsync();
    if (!hasAiConsent(settings, "qa")) {
      const approved = await new Promise<boolean>((resolve) => Alert.alert(
        "确认匣灵数据发送",
        "匣灵会向你配置的 AI 服务发送本地预计算统计和与问题相关的最多 50 条物品字段，不会发送图片或 API Key。",
        [{ text: "取消", style: "cancel", onPress: () => resolve(false) }, { text: "同意", onPress: () => resolve(true) }]
      ));
      if (!approved) return;
      await grantAiConsent("qa");
    }
    const userMsg: QaMessage = { role: "user", content: q };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const answer = await askQuestion(q, messages);
      setMessages([...history, { role: "assistant", content: answer }]);
    } catch (err: any) {
      setMessages([...history, { role: "assistant", content: `❌ ${err.message}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handlePreset = (q: string) => {
    send(q);
  };

  return (
    <View style={[styles.container, { paddingBottom: bottomPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>匣灵</Text>
        <TouchableOpacity
          onPress={() => setMessages([])}
          disabled={messages.length === 0}
        >
          <Ionicons
            name="trash-outline"
            size={20}
            color={messages.length > 0 ? colors.textTertiary : colors.border}
          />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={styles.welcome}>
            <Image
              source={require("../../../assets/xialing-avatar.png")}
              style={styles.welcomeIcon}
            />
            <Text style={styles.welcomeTitle}>匣灵</Text>
            <Text style={styles.welcomeSub}>
              我可以回答关于你物匣、匣中之物的问题{'\n'}试试下面的快捷提问
            </Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/profile")}>
              <Text style={styles.personalityHint}>
                当前性格：{getPersonalityLabel(personalityPreset)} · 去匣主修改
              </Text>
            </TouchableOpacity>
            <View style={styles.presetsGrid}>
              {PRESETS.map((p, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.presetChip}
                  onPress={() => handlePreset(p.question)}
                >
                  <Text style={styles.presetIcon}>{p.icon}</Text>
                  <Text style={styles.presetLabel}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          messages.map((m, i) => (
            <View
              key={i}
              style={[
                styles.bubbleRow,
                m.role === "user" ? styles.bubbleRowUser : styles.bubbleRowBot,
              ]}
            >
              {m.role === "assistant" && (
                <View style={styles.avatarBot}>
                  <Image
                    source={require("../../../assets/xialing-avatar.png")}
                    style={styles.avatarBotImage}
                  />
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  m.role === "user" ? styles.bubbleUser : styles.bubbleBot,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    m.role === "user" ? styles.bubbleTextUser : styles.bubbleTextBot,
                  ]}
                >
                  {m.content}
                </Text>
              </View>
            </View>
          ))
        )}
        {loading && (
          <View style={styles.bubbleRowBot}>
            <View style={styles.avatarBot}>
              <Image
                source={require("../../../assets/xialing-avatar.png")}
                style={styles.avatarBotImage}
              />
            </View>
            <View style={[styles.bubble, styles.bubbleBot, styles.typingBubble]}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="问匣灵点什么..."
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={500}
          onSubmitEditing={() => send(input)}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}
          onPress={() => send(input)}
          disabled={!input.trim() || loading}
        >
          <Ionicons name="send" size={18} color={colors.surface} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

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
  headerTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  // Chat
  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 8 },
  // Welcome
  welcome: { alignItems: "center", paddingTop: 32 },
  welcomeIcon: { width: 88, height: 88, borderRadius: 22, marginBottom: 12 },
  welcomeTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 6 },
  welcomeSub: { fontSize: 14, color: colors.textTertiary, textAlign: "center", lineHeight: 20, marginBottom: 8 },
  personalityHint: { fontSize: 12, color: colors.accent, marginBottom: 24 },
  presetsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, paddingHorizontal: 16 },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetIcon: { fontSize: 16 },
  presetLabel: { fontSize: 13, color: colors.text, fontWeight: "500" },
  // Bubbles
  bubbleRow: { flexDirection: "row", marginBottom: 12, alignItems: "flex-end" },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubbleRowBot: { justifyContent: "flex-start" },
  avatarBot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.accentSoft,
    justifyContent: "center", alignItems: "center",
    marginRight: 8,
    overflow: "hidden",
  },
  avatarBotImage: { width: 32, height: 32 },
  bubble: { maxWidth: "80%", borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleUser: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.surfaceSunken },
  typingBubble: { paddingVertical: 14, paddingHorizontal: 20 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: colors.surface },
  bubbleTextBot: { color: colors.text },
  // Input
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSunken,
    gap: 8,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: colors.surfaceSunken,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
});
