import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const LEVELS = [
  { name: "初启匣主", icon: "📦", minItems: 0 },
  { name: "拾物匣主", icon: "🔰", minItems: 10 },
  { name: "积物匣主", icon: "📚", minItems: 30 },
  { name: "理匣师", icon: "🎯", minItems: 60 },
  { name: "丰匣主人", icon: "👑", minItems: 100 },
  { name: "万物匣主", icon: "🌟", minItems: 200 },
];

function getLevelInfo(totalItems: number) {
  let current = LEVELS[0];
  let next = null;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalItems >= LEVELS[i].minItems) {
      current = LEVELS[i];
      next = LEVELS[i + 1] ?? null;
      break;
    }
  }
  const currentMin = current.minItems;
  const nextMin = next ? next.minItems : currentMin + 1;
  const progress = Math.min(1, Math.max(0, (totalItems - currentMin) / (nextMin - currentMin)));
  return { current, next, progress };
}

type Props = {
  nickname: string;
  avatarUrl: string | null;
  totalItems: number;
};

export default function ProfileHeader({ nickname, avatarUrl, totalItems }: Props) {
  const [levelModalVisible, setLevelModalVisible] = useState(false);
  const levelInfo = getLevelInfo(totalItems);

  return (
    <>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => router.push("/(tabs)/profile/edit")}
        activeOpacity={0.8}
      >
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>
                {nickname?.charAt(0)?.toUpperCase() || "匣"}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.nickname} numberOfLines={1}>
            {nickname || "未名匣主"}
          </Text>
          <Text style={styles.editHint}>点击编辑匣主</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
      </TouchableOpacity>

      {/* Level Card */}
      <TouchableOpacity
        style={styles.levelCard}
        onPress={() => setLevelModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.levelIcon}>{levelInfo.current.icon}</Text>
        <View style={styles.levelInfo}>
          <Text style={styles.levelName}>{levelInfo.current.name}</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${Math.round(levelInfo.progress * 100)}%` }]}
              />
            </View>
            <Text style={styles.progressLabel}>
              {levelInfo.next ? `${totalItems}/${levelInfo.next.minItems}` : "MAX"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Level Modal */}
      <Modal
        visible={levelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLevelModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLevelModalVisible(false)}
        >
          <TouchableOpacity style={styles.modalCard} activeOpacity={1}>
            <Text style={styles.modalTitle}>匣主等级</Text>
            <View style={styles.levelCurrent}>
              <Text style={styles.levelCurrentIcon}>{levelInfo.current.icon}</Text>
              <Text style={styles.levelCurrentName}>{levelInfo.current.name}</Text>
            </View>
            {levelInfo.next && (
              <Text style={styles.progressText}>
                进度 {totalItems}/{levelInfo.next.minItems} · 下一级：{levelInfo.next.name}
              </Text>
            )}
            <View style={styles.levelList}>
              {LEVELS.map((lvl) => {
                const isActive = totalItems >= lvl.minItems;
                return (
                  <View
                    key={lvl.name}
                    style={[styles.levelRow, isActive && styles.levelRowActive]}
                  >
                    <Text style={styles.levelRowIcon}>{lvl.icon}</Text>
                    <Text
                      style={[styles.levelRowName, isActive && styles.levelRowNameActive]}
                    >
                      {lvl.name}
                    </Text>
                    <Text style={styles.levelRowCount}>{lvl.minItems}+</Text>
                  </View>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setLevelModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>知道了</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  avatarContainer: { marginRight: 12 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#F3F4F6" },
  avatarPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholderText: { fontSize: 22, fontWeight: "700", color: "#4F46E5" },
  headerInfo: { flex: 1 },
  nickname: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 2 },
  editHint: { fontSize: 13, color: "#9CA3AF" },
  // Level card
  levelCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    gap: 12,
  },
  levelIcon: { fontSize: 28 },
  levelInfo: { flex: 1 },
  levelName: { fontSize: 15, fontWeight: "600", color: "#374151", marginBottom: 4 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressBar: { flex: 1, height: 6, backgroundColor: "#F3F4F6", borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: "#7C3AED", borderRadius: 3 },
  progressLabel: { fontSize: 12, color: "#9CA3AF", minWidth: 48, textAlign: "right" },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 32 },
  modalCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24, width: "100%", maxWidth: 340 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#111827", textAlign: "center", marginBottom: 16 },
  modalCloseBtn: { marginTop: 20, height: 44, backgroundColor: "#4F46E5", borderRadius: 10, justifyContent: "center", alignItems: "center" },
  modalCloseText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  // Level modal
  levelCurrent: { alignItems: "center", marginBottom: 12 },
  levelCurrentIcon: { fontSize: 48, marginBottom: 4 },
  levelCurrentName: { fontSize: 18, fontWeight: "700", color: "#7C3AED" },
  progressText: { fontSize: 13, color: "#6B7280", textAlign: "center", marginBottom: 20 },
  levelList: { gap: 8 },
  levelRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#F9FAFB" },
  levelRowActive: { backgroundColor: "#F3E8FF" },
  levelRowIcon: { fontSize: 20, marginRight: 10 },
  levelRowName: { flex: 1, fontSize: 14, fontWeight: "500", color: "#9CA3AF" },
  levelRowNameActive: { color: "#7C3AED", fontWeight: "600" },
  levelRowCount: { fontSize: 13, color: "#9CA3AF" },
});
