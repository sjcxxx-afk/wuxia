import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { itemRepository } from "../../../../src/repositories/itemRepository";
import { saveImages, deleteImages } from "../../../../src/storage/imageStore";
import ItemForm from "../../../../components/ItemForm";

export default function EditItem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [defaults, setDefaults] = useState<Record<string, string> | null>(null);
  const [initialImages, setInitialImages] = useState<string[]>([]);
  const [initialCustomValues, setInitialCustomValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    itemRepository.getById(id).then((data) => {
      if (data) {
        setDefaults({
          name: data.name,
          categoryId: data.category?.id ?? "",
          brand: data.brand ?? "",
          purchaseDate: data.purchaseDate ?? "",
          purchasePrice: data.purchasePrice != null ? String(data.purchasePrice) : "",
          purchasePlatform: data.purchasePlatform ?? "",
          storeName: data.storeName ?? "",
          location: data.location ?? "",
          quantity: String(data.quantity ?? 1),
          status: data.status,
          notes: data.notes ?? "",
        });
        setInitialImages(data.images ?? []);
        setInitialCustomValues(data.customValues ?? {});
      }
    });
  }, [id]);

  const handleSave = async (
    values: Record<string, string>,
    images: string[],
    customValues: Record<string, string>
  ) => {
    if (!id) return;
    setLoading(true);
    try {
      // Save new images (only the ones that are temp URIs, not already persisted)
      const newUris = images.filter((uri) => !initialImages.includes(uri));
      const removedUris = initialImages.filter((uri) => !images.includes(uri));

      // Delete removed images
      if (removedUris.length > 0) {
        await deleteImages(removedUris);
      }

      // Save new images
      const savedUris = await saveImages(newUris);
      const keptUris = images.filter((uri) => initialImages.includes(uri));
      const finalImages = [...keptUris, ...savedUris];

      await itemRepository.update(id, {
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
        images: finalImages,
        customValues,
      });
      router.canGoBack() ? router.back() : router.replace("/(tabs)/items");
    } catch (err: any) {
      Alert.alert("保存失败", err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!defaults) {
    return (
      <View style={styles.container}>
        <ActivityIndicator style={{ marginTop: 100 }} size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/items")}>
          <Ionicons name="close" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>编辑物品</Text>
        <View style={{ width: 24 }} />
      </View>
      <ItemForm
        initial={defaults}
        initialImages={initialImages}
        initialCustomValues={initialCustomValues}
        onSave={handleSave}
        loading={loading}
      />
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
