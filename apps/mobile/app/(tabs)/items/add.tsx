import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { itemRepository } from "../../../lib/repositories/itemRepository";
import { saveImages } from "../../../lib/storage/imageStore";
import ItemForm from "../../../components/ItemForm";

export default function AddItem() {
  const [loading, setLoading] = useState(false);

  const handleSave = async (
    values: Record<string, string>,
    images: string[],
    customValues: Record<string, string>
  ) => {
    setLoading(true);
    try {
      const savedImages = await saveImages(images);
      await itemRepository.create({
        name: values.name,
        categoryId: values.categoryId || null,
        brand: values.brand || null,
        purchaseDate: values.purchaseDate || null,
        purchasePrice: values.purchasePrice ? parseFloat(values.purchasePrice) : null,
        purchasePlatform: values.purchasePlatform || null,
        storeName: values.storeName || null,
        location: values.location || null,
        quantity: parseInt(values.quantity) || 1,
        status: values.status,
        notes: values.notes || null,
        images: savedImages,
        customValues,
      });
      router.canGoBack() ? router.back() : router.replace("/(tabs)/items");
    } catch (err: any) {
      Alert.alert("保存失败", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/items")}>
          <Ionicons name="close" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>入匣</Text>
        <View style={{ width: 24 }} />
      </View>
      <ItemForm onSave={handleSave} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTitle: { fontSize: 17, fontWeight: "600", color: "#111827" },
});
