import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { itemRepository } from "../../../lib/repositories/itemRepository";
import { categoryRepository } from "../../../lib/repositories/categoryRepository";
import { getOcrSettingsAsync } from "../../../lib/ocr/ocrService";
import { generateAndSaveItemReview, getItemReviewFailureMessage } from "../../../lib/ai/itemReviewService";
import { resolveImageUri } from "../../../lib/storage/imageStore";
import { Item, CustomField } from "../../../lib/types";
import StatusBadge from "../../../components/StatusBadge";
import confirmDialog from "../../../components/ConfirmDialog";
import { colors } from "../../../lib/theme";
import Icon from "../../../components/Icon";

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Item | null>(null);
  const [categoryFields, setCategoryFields] = useState<CustomField[]>([]);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [itemReviewEnabled, setItemReviewEnabled] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadItem = useCallback(async () => {
    if (!id) return;
    const data = await itemRepository.getById(id);
    if (data) {
      setItem(data);
      if (data.category?.id) {
        const cats = await categoryRepository.list();
        const cat = cats.find((c) => c.id === data.category!.id);
        setCategoryFields(cat?.customFields ?? []);
      } else {
        setCategoryFields([]);
      }
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      getOcrSettingsAsync().then((s) => setItemReviewEnabled(s.itemReviewEnabled));
      loadItem();
    }, [loadItem])
  );

  useEffect(() => {
    if (!id || !itemReviewEnabled || item?.aiReviewStatus !== "pending") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    pollRef.current = setInterval(() => {
      loadItem();
    }, 1000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [id, item, itemReviewEnabled, loadItem]);

  const handleDelete = () => {
    confirmDialog("移出物匣", `确认将「${item?.name}」移出物匣？此操作不可撤销。`, async () => {
      await itemRepository.delete(id!);
      router.canGoBack() ? router.back() : router.replace("/(tabs)/items");
    });
  };

  const handleRetryReview = () => {
    if (!id || item?.aiReviewStatus === "pending") return;
    setItem((current) => current ? {
      ...current,
      aiComment: null,
      aiCommentAt: null,
      aiReviewStatus: "pending",
      aiReviewError: null,
      aiReviewStartedAt: new Date().toISOString(),
    } : current);
    void generateAndSaveItemReview(id);
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

  const reviewPending = item.aiReviewStatus === "pending";
  const reviewElapsedSeconds = item.aiReviewStartedAt
    ? Math.max(1, Math.floor((Date.now() - new Date(item.aiReviewStartedAt).getTime()) / 1000))
    : 0;
  const showReviewCard = itemReviewEnabled;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/items")}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {item.name}
        </Text>
        <TouchableOpacity onPress={handleDelete}>
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
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
                  source={{ uri: resolveImageUri(uri) }}
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

        {/* AI Review Card */}
        {showReviewCard && (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Icon name="inkDrop" size={16} color={colors.accent} />
              <Text style={styles.reviewTitle}>匣灵评价</Text>
            </View>
            {item.aiComment ? (
              <>
                <Text style={styles.reviewText}>{item.aiComment}</Text>
                {item.aiCommentAt && (
                  <Text style={styles.reviewTime}>
                    {new Date(item.aiCommentAt).toLocaleString("zh-CN")}
                  </Text>
                )}
              </>
            ) : (
              <View style={styles.reviewLoading}>
                {reviewPending ? (
                  <>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={styles.reviewLoadingText}>匣灵正在评价…已等待 {reviewElapsedSeconds} 秒</Text>
                  </>
                ) : item.aiReviewStatus === "failed" && item.aiReviewError ? (
                  <View style={styles.reviewFailed}>
                    <Text style={styles.reviewLoadingText}>{getItemReviewFailureMessage(item.aiReviewError)}</Text>
                    <TouchableOpacity style={styles.retryReviewBtn} onPress={handleRetryReview}>
                      <Text style={styles.retryReviewText}>重新评价</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.reviewLoadingText}>暂无评价（可改匣后重新触发）</Text>
                )}
              </View>
            )}
          </View>
        )}

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
          <Ionicons name="create-outline" size={18} color={colors.surface} />
          <Text style={styles.editBtnText}>改匣</Text>
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
              source={{ uri: resolveImageUri(fullImage) }}
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
  container: { flex: 1, backgroundColor: colors.background },
  loading: { textAlign: "center", marginTop: 100, color: colors.textTertiary },
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
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.text, textAlign: "center", marginHorizontal: 12 },
  body: { flex: 1 },
  imageGallery: {
    maxHeight: 180,
    paddingTop: 16,
  },
  galleryImage: {
    width: 160,
    height: 160,
    borderRadius: 12,
    backgroundColor: colors.surfaceSunken,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  itemName: { fontSize: 22, fontWeight: "700", color: colors.text, flex: 1, marginRight: 12 },
  reviewCard: {
    backgroundColor: colors.accentSoft,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.accentSoft,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  reviewTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.accent,
  },
  reviewText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  reviewTime: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 8,
  },
  reviewLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reviewFailed: { gap: 10 },
  retryReviewBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  retryReviewText: { color: colors.surface, fontSize: 13, fontWeight: "600" },
  reviewLoadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceSunken,
  },
  customSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.accent,
    marginBottom: 8,
  },
  field: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  fieldLabel: { fontSize: 14, color: colors.textTertiary, flex: 1 },
  fieldValue: { fontSize: 14, color: colors.text, fontWeight: "500", flex: 2, textAlign: "right" },
  editBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 40,
    height: 48,
    backgroundColor: colors.accent,
    borderRadius: 12,
    gap: 8,
  },
  editBtnText: { color: colors.surface, fontSize: 16, fontWeight: "600" },
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
