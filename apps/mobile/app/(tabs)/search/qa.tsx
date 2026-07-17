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
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { askQuestion, QaMessage } from "../../../lib/ai/qaService";

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
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

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
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>匣灵</Text>
        <TouchableOpacity
          onPress={() => setMessages([])}
          disabled={messages.length === 0}
        >
          <Ionicons
            name="trash-outline"
            size={20}
            color={messages.length > 0 ? "#9CA3AF" : "#E5E7EB"}
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
              <ActivityIndicator size="small" color="#4F46E5" />
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
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
          onSubmitEditing={() => send(input)}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}
          onPress={() => send(input)}
          disabled={!input.trim() || loading}
        >
          <Ionicons name="send" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

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
  headerTitle: { fontSize: 17, fontWeight: "600", color: "#111827" },
  // Chat
  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 8 },
  // Welcome
  welcome: { alignItems: "center", paddingTop: 32 },
  welcomeIcon: { width: 88, height: 88, borderRadius: 22, marginBottom: 12 },
  welcomeTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 6 },
  welcomeSub: { fontSize: 14, color: "#9CA3AF", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  presetsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, paddingHorizontal: 16 },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  presetIcon: { fontSize: 16 },
  presetLabel: { fontSize: 13, color: "#374151", fontWeight: "500" },
  // Bubbles
  bubbleRow: { flexDirection: "row", marginBottom: 12, alignItems: "flex-end" },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubbleRowBot: { justifyContent: "flex-start" },
  avatarBot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#EEF2FF",
    justifyContent: "center", alignItems: "center",
    marginRight: 8,
    overflow: "hidden",
  },
  avatarBotImage: { width: 32, height: 32 },
  bubble: { maxWidth: "80%", borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleUser: { backgroundColor: "#4F46E5", borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: "#FFFFFF", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "#F3F4F6" },
  typingBubble: { paddingVertical: 14, paddingHorizontal: 20 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: "#FFFFFF" },
  bubbleTextBot: { color: "#111827" },
  // Input
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 8,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    lineHeight: 20,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
  },
});
