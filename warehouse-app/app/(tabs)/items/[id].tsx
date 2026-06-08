import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  StyleSheet,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { itemRepository } from "../../../src/repositories/itemRepository";
import { categoryRepository } from "../../../src/repositories/categoryRepository";
import { Item, CustomField } from "../../../src/types";
import StatusBadge from "../../../components/StatusBadge";
import confirmDialog from "../../../components/ConfirmDialog";

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Item | null>(null);
  const [categoryFields, setCategoryFields] = useState<CustomField[]>([]);
  const [fullImage, setFullImage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    itemRepository.getById(id).then((data) => {
      if (data) {
        setItem(data);
        // Load category's custom fields for displaying labels
        if (data.category?.id) {
          categoryRepository.list().then((cats) => {
            const cat = cats.find((c) => c.id === data.category!.id);
            setCategoryFields(cat?.customFields ?? []);
          });
        }
      }
    });
  }, [id]);

  const handleDelete = () => {
    confirmDialog("删除物品", `确认删除"${item?.name}"？此操作不可撤销。`, async () => {
      await itemRepository.delete(id!);
      router.canGoBack() ? router.back() : router.replace("/(tabs)/items");
    });
  };

  if (!item) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>加载中...</Text>
      </View>
    );
  }

  const Field = ({ label, value }: { label: string; value?: string | number | null }) => {
    if (value == null || value === "") return null;
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{String(value)}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/items")}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {item.name}
        </Text>
        <TouchableOpacity onPress={handleDelete}>
          <Ionicons name="trash-outline" size={22} color="#DC2626" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body}>
        {/* Image Gallery */}
        {item.images && item.images.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.imageGallery}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            {item.images.map((uri, idx) => (
              <TouchableOpacity key={idx} onPress={() => setFullImage(uri)}>
                <Image
                  source={{ uri }}
                  style={styles.galleryImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Title Row */}
        <View style={styles.titleRow}>
          <Text style={styles.itemName}>{item.name}</Text>
          <StatusBadge status={item.status} />
        </View>

        {/* Main Info Card */}
        <View style={styles.card}>
          <Field label="品牌" value={item.brand} />
          <Field label="分类" value={item.category?.name ?? null} />
          <Field
            label="购买价格"
            value={item.purchasePrice != null ? `¥${Number(item.purchasePrice).toFixed(2)}` : null}
          />
          <Field label="数量" value={item.quantity} />
          <Field label="购买时间" value={item.purchaseDate} />
          <Field label="购买平台" value={item.purchasePlatform} />
          <Field label="店铺名称" value={item.storeName} />
          <Field label="存放位置" value={item.location} />
          <Field label="备注" value={item.notes} />
        </View>

        {/* Custom Fields */}
        {categoryFields.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.customSectionTitle}>自定义字段</Text>
            {categoryFields.map((f) => {
              const val = item.customValues?.[f.id];
              if (!val) return null;
              return <Field key={f.id} label={f.name} value={val} />;
            })}
          </View>
        )}

        {/* Edit Button */}
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push(`/(tabs)/items/edit/${item.id}`)}
        >
          <Ionicons name="create-outline" size={18} color="#FFFFFF" />
          <Text style={styles.editBtnText}>编辑物品</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Full Image Modal */}
      <Modal
        visible={!!fullImage}
        transparent
        animationType="fade"
        onRequestClose={() => setFullImage(null)}
      >
        <TouchableOpacity
          style={styles.fullImageOverlay}
          activeOpacity={1}
          onPress={() => setFullImage(null)}
        >
          {fullImage && (
            <Image
              source={{ uri: fullImage }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  loading: { textAlign: "center", marginTop: 100, color: "#9CA3AF" },
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
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: "#111827", textAlign: "center", marginHorizontal: 12 },
  body: { flex: 1 },
  // Image gallery
  imageGallery: {
    maxHeight: 180,
    paddingTop: 16,
  },
  galleryImage: {
    width: 160,
    height: 160,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  // Title
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  itemName: { fontSize: 22, fontWeight: "700", color: "#111827", flex: 1, marginRight: 12 },
  // Info card
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  customSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4F46E5",
    marginBottom: 8,
  },
  field: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F9FAFB",
  },
  fieldLabel: { fontSize: 14, color: "#9CA3AF", flex: 1 },
  fieldValue: { fontSize: 14, color: "#111827", fontWeight: "500", flex: 2, textAlign: "right" },
  // Edit button
  editBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 40,
    height: 48,
    backgroundColor: "#4F46E5",
    borderRadius: 12,
    gap: 8,
  },
  editBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  // Full image modal
  fullImageOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: "100%",
    height: "80%",
  },
});
