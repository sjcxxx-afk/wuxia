import { loadData, updateData, nowISO, generateId } from "../storage/jsonStore";
import { triggerAutoExport } from "../storage/syncService";
import { deleteImages } from "../storage/imageStore";
import { getReminderSettings } from "../storage/reminderSettings";
import { generateAndSaveItemReview } from "../ai/itemReviewService";
import type {
  Item,
  ItemSummary,
  CreateItemInput,
  UpdateItemInput,
  SearchFilters,
  ItemStats,
} from "../types";

function toItem(raw: any, data: any): Item {
  const cat = data.categories.find((c: any) => c.id === raw.categoryId);
  return {
    id: raw.id,
    name: raw.name,
    brand: raw.brand ?? null,
    purchaseDate: raw.purchaseDate ?? null,
    purchasePrice: raw.purchasePrice ?? null,
    purchasePlatform: raw.purchasePlatform ?? null,
    storeName: raw.storeName ?? null,
    location: raw.location ?? null,
    quantity: raw.quantity ?? 1,
    status: raw.status ?? "使用中",
    notes: raw.notes ?? null,
    images: raw.images ?? [],
    customValues: raw.customValues ?? {},
    aiComment: raw.aiComment ?? null,
    aiCommentAt: raw.aiCommentAt ?? null,
    category: cat ? { id: cat.id, name: cat.name } : null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function toSummary(raw: any, data: any): ItemSummary {
  const cat = data.categories.find((c: any) => c.id === raw.categoryId);
  return {
    id: raw.id,
    name: raw.name,
    purchasePrice: raw.purchasePrice ?? null,
    status: raw.status,
    purchaseDate: raw.purchaseDate ?? null,
    brand: raw.brand ?? null,
    images: raw.images ?? [],
    customValues: raw.customValues ?? {},
    category: cat ? { name: cat.name } : null,
  };
}

/** 判断物品是否为超过阈值的闲置物品 */
function isIdleOverdue(item: any, thresholdDays: number): boolean {
  if (item.status !== "闲置中") return false;
  const seconds = thresholdDays * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(item.updatedAt).getTime() > seconds;
}

export const itemRepository = {
  async ensureLoaded() {
    await loadData();
  },

  async list(): Promise<ItemSummary[]> {
    const data = await loadData();
    return [...data.items]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((item) => toSummary(item, data));
  },

  async listByCategory(categoryId: string): Promise<ItemSummary[]> {
    const data = await loadData();
    return data.items
      .filter((item) => item.categoryId === categoryId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((item) => toSummary(item, data));
  },

  async getById(id: string): Promise<Item | null> {
    const data = await loadData();
    const raw = data.items.find((item) => item.id === id);
    if (!raw) return null;
    return toItem(raw, data);
  },

  async create(input: CreateItemInput): Promise<string> {
    const id = generateId();
    const now = nowISO();
    updateData((data) => ({
      ...data,
      items: [
        ...data.items,
        {
          id,
          name: input.name,
          categoryId: input.categoryId ?? null,
          brand: input.brand ?? null,
          purchaseDate: input.purchaseDate ?? null,
          purchasePrice: input.purchasePrice ?? null,
          purchasePlatform: input.purchasePlatform ?? null,
          storeName: input.storeName ?? null,
          location: input.location ?? null,
          quantity: input.quantity ?? 1,
          status: input.status ?? "使用中",
          notes: input.notes ?? null,
          images: input.images ?? [],
          customValues: input.customValues ?? {},
          aiComment: null,
          aiCommentAt: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
    triggerAutoExport();
    void generateAndSaveItemReview(id);
    return id;
  },

  async update(id: string, input: UpdateItemInput): Promise<void> {
    updateData((data) => ({
      ...data,
      items: data.items.map((item) => {
        if (item.id !== id) return item;
        const updated: any = {
          ...item,
          updatedAt: nowISO(),
          aiComment: null,
          aiCommentAt: null,
        };
        if (input.name !== undefined) updated.name = input.name;
        if (input.categoryId !== undefined) updated.categoryId = input.categoryId;
        if (input.brand !== undefined) updated.brand = input.brand;
        if (input.purchaseDate !== undefined) updated.purchaseDate = input.purchaseDate;
        if (input.purchasePrice !== undefined) updated.purchasePrice = input.purchasePrice;
        if (input.purchasePlatform !== undefined) updated.purchasePlatform = input.purchasePlatform;
        if (input.storeName !== undefined) updated.storeName = input.storeName;
        if (input.location !== undefined) updated.location = input.location;
        if (input.quantity !== undefined) updated.quantity = input.quantity;
        if (input.status !== undefined) updated.status = input.status;
        if (input.notes !== undefined) updated.notes = input.notes;
        if (input.images !== undefined) updated.images = input.images;
        if (input.customValues !== undefined) updated.customValues = input.customValues;
        return updated;
      }),
    }));
    triggerAutoExport();
    void generateAndSaveItemReview(id);
  },

  async setAiComment(id: string, comment: string): Promise<void> {
    updateData((data) => ({
      ...data,
      items: data.items.map((item) =>
        item.id === id
          ? { ...item, aiComment: comment, aiCommentAt: nowISO() }
          : item
      ),
    }));
    triggerAutoExport();
  },

  async delete(id: string): Promise<void> {
    const data = await loadData();
    const item = data.items.find((i) => i.id === id);
    if (item?.images?.length) {
      await deleteImages(item.images);
    }
    const deletedAt = nowISO();
    updateData((data) => ({
      ...data,
      items: data.items.filter((item) => item.id !== id),
      deletedItems: [
        ...data.deletedItems.filter((tombstone) => tombstone.id !== id),
        { id, deletedAt },
      ],
    }));
    triggerAutoExport();
  },

  async search(query: string, filters: SearchFilters): Promise<ItemSummary[]> {
    const data = await loadData();
    const q = query.trim().toLowerCase();
    let results = data.items;
    if (q) {
      results = results.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.brand && item.brand.toLowerCase().includes(q)) ||
          (item.notes && item.notes.toLowerCase().includes(q))
      );
    }
    if (filters.categoryId) {
      results = results.filter((item) => item.categoryId === filters.categoryId);
    }
    if (filters.status) {
      results = results.filter((item) => item.status === filters.status);
    }
    return results
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50)
      .map((item) => toSummary(item, data));
  },

  /** 获取超过提醒阈值的闲置物品列表 */
  async getIdleOverdue(days?: number): Promise<ItemSummary[]> {
    const data = await loadData();
    const threshold = days ?? getReminderSettings().idleReminderDays;
    const overdue = data.items
      .filter((item) => isIdleOverdue(item, threshold))
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
      .map((item) => toSummary(item, data));
    return overdue;
  },

  async getStats(): Promise<ItemStats> {
    const data = await loadData();
    const total = data.items.length;
    const totalValue = data.items.reduce((sum, item) => sum + (item.purchasePrice ?? 0), 0);
    const idle = data.items.filter((item) => item.status === "闲置中").length;
    const threshold = getReminderSettings().idleReminderDays;
    const idleOverdue = data.items.filter((item) => isIdleOverdue(item, threshold)).length;
    return { total, totalValue, idle, idleOverdue };
  },
};
