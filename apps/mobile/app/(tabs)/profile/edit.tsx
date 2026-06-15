import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { profileRepository } from "../../../lib/repositories/profileRepository";

const isWeb = Platform.OS === "web";

export default function EditProfile() {
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    profileRepository.get().then((data) => {
      setNickname(data.nickname || "");
      setAvatarUrl(data.avatarUrl);
    });
  }, []);

  const handlePickAvatar = async () => {
    if (isWeb) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setAvatarUrl(reader.result as string);
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }

    // Native: use expo-image-picker
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("需要权限", "请在设置中允许访问相册");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setAvatarUrl(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await profileRepository.update({
        nickname: nickname.trim() || "",
        avatarUrl,
      });
      router.canGoBack() ? router.back() : router.replace("/(tabs)/profile");
    } catch (err: any) {
      Alert.alert("保存失败", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/profile")}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>编辑资料</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.form}>
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickAvatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={36} color="#9CA3AF" />
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>点击更换头像</Text>
        </View>

        <Text style={styles.label}>昵称</Text>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder="输入你的昵称"
          placeholderTextColor="#9CA3AF"
        />

        <TouchableOpacity
          style={[styles.saveBtn, loading && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveText}>{loading ? "保存中..." : "保存"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  headerTitle: { fontSize: 17, fontWeight: "600", color: "#111827" },
  form: { padding: 16, marginTop: 12 },
  avatarSection: { alignItems: "center", marginBottom: 28 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  cameraBadge: { position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: "#4F46E5", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#FFFFFF" },
  avatarHint: { fontSize: 13, color: "#9CA3AF", marginTop: 8 },
  label: { fontSize: 15, fontWeight: "600", color: "#374151", marginBottom: 8 },
  input: { height: 46, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: "#111827", backgroundColor: "#F9FAFB" },
  saveBtn: { marginTop: 32, height: 48, backgroundColor: "#4F46E5", borderRadius: 12, justifyContent: "center", alignItems: "center" },
  saveText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
});