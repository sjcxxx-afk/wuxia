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

export default function ProfileScreen() {
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<ItemStats>({ total: 0, totalValue: 0, idle: 0, idleOverdue: 0 });

  const refresh = useCallback(async () => {
    const p = await profileRepository.get();
    setNickname(p.nickname || "未设置");
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
    <ScrollView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
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
          <Ionicons name="stats-chart-outline" size={20} color="#4F46E5" />
        </View>
        <Text style={localStyles.statsBtnText}>查看数据统计图表</Text>
        <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
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
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    gap: 10,
  },
  statsIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  statsBtnText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#374151" },
});
