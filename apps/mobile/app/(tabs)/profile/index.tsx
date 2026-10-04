import { useEffect, useState, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { profileRepository } from "../../../lib/repositories/profileRepository";
import { itemRepository } from "../../../lib/repositories/itemRepository";
import { loadData } from "../../../lib/storage/jsonStore";
import { ItemStats } from "../../../lib/types";
import ProfileHeader from "../../../components/ProfileHeader";
import StatsRow from "../../../components/StatsRow";
import SyncSettingsCard from "../../../components/SyncSettingsCard";
import AiSettingsCard from "../../../components/AiSettingsCard";
import ReminderSettingsCard from "../../../components/ReminderSettingsCard";
import { colors } from "../../../lib/theme";

export default function ProfileScreen() {
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<ItemStats>({ total: 0, totalValue: 0, idle: 0, idleOverdue: 0 });

  const refresh = useCallback(async () => {
    const p = await profileRepository.get();
    setNickname(p.nickname || "未名匣主");
    setAvatarUrl(p.avatarUrl);
    const s = await itemRepository.getStats();
    setStats(s);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <ProfileHeader
        nickname={nickname}
        avatarUrl={avatarUrl}
        totalItems={stats.total}
      />
      <StatsRow
        stats={stats}
        onIdlePress={() => router.push("/(tabs)/items/idle")}
      />

      {/* 查看统计入口 */}
      <TouchableOpacity
        style={localStyles.statsBtn}
        onPress={() => router.push("/(tabs)/profile/stats")}
      >
        <View style={localStyles.statsIconBox}>
          <Ionicons name="stats-chart-outline" size={20} color={colors.accent} />
        </View>
        <Text style={localStyles.statsBtnText}>查看物匣统计</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </TouchableOpacity>

      <ReminderSettingsCard />
      <SyncSettingsCard />
      <AiSettingsCard />
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  statsBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surfaceSunken,
    gap: 10,
  },
  statsIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  statsBtnText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },
});
