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

import Icon from "./Icon";
import { LEVEL_ICON_NAMES } from "../lib/icons";
import { colors } from "../lib/theme";

/**
 * 匣主等级。
 *
 * 原先用 emoji（📦🔰📚🎯👑🌟）当等级图标有两个问题：一是 emoji 的彩色塑料感
 * 与整套线性水墨图标完全割裂；二是它们不承载任何叙事 —— 🎯👑🌟 和「收了多少件物」
 * 毫无关系。换成「一只木匣逐渐被填满、最后满匣生光」之后，
 * 图标本身就在讲这个产品要讲的故事。
 */
const LEVELS = [
  { name: "初启匣主", minItems: 0 },
  { name: "拾物匣主", minItems: 10 },
  { name: "积物匣主", minItems: 30 },
  { name: "理匣师", minItems: 60 },
  { name: "丰匣主人", minItems: 100 },
  { name: "万物匣主", minItems: 200 },
] as const;

/** 等级下标（1 起）→ 图标名 */
const LEVEL_ICON_BY_INDEX = LEVEL_ICON_NAMES;

function getLevelInfo(totalItems: number) {
  // 同时返回当前等级的下标，等级图标要靠它
  let currentIndex = 0;
  let next = null;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalItems >= LEVELS[i].minItems) {
      currentIndex = i;
      next = LEVELS[i + 1] ?? null;
      break;
    }
  }
  const current = LEVELS[currentIndex];
  const currentMin = current.minItems;
  const nextMin = next ? next.minItems : currentMin + 1;
  const progress = Math.min(1, Math.max(0, (totalItems - currentMin) / (nextMin - currentMin)));
  return { current, currentIndex, next, progress };
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
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </TouchableOpacity>

      {/* Level Card */}
      <TouchableOpacity
        style={styles.levelCard}
        onPress={() => setLevelModalVisible(true)}
        activeOpacity={0.8}
      >
        <Icon
          name={LEVEL_ICON_BY_INDEX[levelInfo.currentIndex]}
          size={30}
          color={colors.accent}
        />
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
              <Icon
                name={LEVEL_ICON_BY_INDEX[levelInfo.currentIndex]}
                size={52}
                color={colors.accent}
                active
              />
              <Text style={styles.levelCurrentName}>{levelInfo.current.name}</Text>
            </View>
            {levelInfo.next && (
              <Text style={styles.progressText}>
                进度 {totalItems}/{levelInfo.next.minItems} · 下一级：{levelInfo.next.name}
              </Text>
            )}
            <View style={styles.levelList}>
              {LEVELS.map((lvl, i) => {
                const isActive = totalItems >= lvl.minItems;
                return (
                  <View
                    key={lvl.name}
                    style={[styles.levelRow, isActive && styles.levelRowActive]}
                  >
                    <Icon
                      name={LEVEL_ICON_BY_INDEX[i]}
                      size={20}
                      color={isActive ? colors.accent : colors.iconMuted}
                    />
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSunken,
  },
  avatarContainer: { marginRight: 12 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.surfaceSunken },
  avatarPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.accentSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholderText: { fontSize: 22, fontWeight: "700", color: colors.accent },
  headerInfo: { flex: 1 },
  nickname: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 2 },
  editHint: { fontSize: 13, color: colors.textTertiary },
  // Level card
  levelCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceSunken,
    gap: 12,
  },
  levelInfo: { flex: 1 },
  levelName: { fontSize: 15, fontWeight: "600", color: colors.text, marginBottom: 4 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressBar: { flex: 1, height: 6, backgroundColor: colors.surfaceSunken, borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: colors.accent, borderRadius: 3 },
  progressLabel: { fontSize: 12, color: colors.textTertiary, minWidth: 48, textAlign: "right" },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 32 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: "100%", maxWidth: 340 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: colors.text, textAlign: "center", marginBottom: 16 },
  modalCloseBtn: { marginTop: 20, height: 44, backgroundColor: colors.accent, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  modalCloseText: { color: colors.surface, fontSize: 15, fontWeight: "600" },
  // Level modal
  levelCurrent: { alignItems: "center", marginBottom: 12 },
  levelCurrentName: { fontSize: 18, fontWeight: "700", color: colors.accent, marginTop: 6 },
  progressText: { fontSize: 13, color: colors.textSecondary, textAlign: "center", marginBottom: 20 },
  levelList: { gap: 8 },
  // gap 10 是原来 levelRowIcon 的 marginRight —— 换成 Icon 组件后
  // 它自己是个固定尺寸的 View，间距得由父容器的 gap 给
  levelRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.background },
  levelRowActive: { backgroundColor: colors.accentSoft },
  levelRowName: { flex: 1, fontSize: 14, fontWeight: "500", color: colors.textTertiary },
  levelRowNameActive: { color: colors.accent, fontWeight: "600" },
  levelRowCount: { fontSize: 13, color: colors.textTertiary },
});
