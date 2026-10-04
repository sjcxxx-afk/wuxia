import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { router } from "expo-router";
import { ItemSummary } from "../lib/types";
import StatusBadge from "./StatusBadge";
import { colors } from "../lib/theme";

export default function ItemCard({ item }: { item: ItemSummary }) {
  const priceLabel = item.purchasePrice != null ? `¥${Number(item.purchasePrice).toFixed(0)}` : null;
  const hasImage = item.images && item.images.length > 0;
  const customCount = item.customValues ? Object.keys(item.customValues).length : 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(tabs)/items/${item.id}`)}
    >
      <View style={styles.row}>
        {hasImage && (
          <Image source={{ uri: item.images[0] }} style={styles.thumb} resizeMode="cover" />
        )}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {item.brand ? (
            <Text style={styles.brand} numberOfLines={1}>
              {item.brand}
            </Text>
          ) : null}
          <View style={styles.meta}>
            {item.category?.name ? (
              <Text style={styles.category}>{item.category.name}</Text>
            ) : null}
            {customCount > 0 && (
              <Text style={styles.customBadge}>{customCount} 项</Text>
            )}
            {item.purchaseDate ? (
              <Text style={styles.date}>{item.purchaseDate}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.right}>
          <StatusBadge status={item.status} />
          {priceLabel ? <Text style={styles.price}>{priceLabel}</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    elevation: 1,
    borderWidth: 1,
    borderColor: colors.surfaceSunken,
  },
  row: { flexDirection: "row", alignItems: "center" },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.surfaceSunken,
    marginRight: 12,
  },
  info: { flex: 1, marginRight: 12 },
  name: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 2 },
  brand: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  category: {
    fontSize: 12,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  customBadge: {
    fontSize: 11,
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  date: { fontSize: 12, color: colors.textTertiary },
  right: { alignItems: "flex-end", justifyContent: "space-between" },
  price: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 6 },
});
