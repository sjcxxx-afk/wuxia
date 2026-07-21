import { loadData, updateData, nowISO, generateId } from "../storage/jsonStore";
import { triggerAutoExport } from "../storage/syncService";
import type { Category, CreateCategoryInput, UpdateCategoryInput } from "../types";

function generateFieldId(): string {
  return "fld_" + generateId().slice(0, 8);
}

export const categoryRepository = {
  async ensureLoaded() {
    await loadData();
  },

  async list(): Promise<Category[]> {
    const data = await loadData();
    return [...data.categories]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({
        ...c,
        customFields: (c.customFields ?? []) as Category["customFields"],
      }));
  },

  async create(input: CreateCategoryInput): Promise<string> {
    const id = generateId();
    const now = nowISO();
    const customFields = (input.customFields ?? []).map((f, i) => ({
      id: generateFieldId(),
      name: f.name,
      type: f.type,
      sortOrder: i,
    }));
    updateData((data) => ({
      ...data,
      categories: [
        ...data.categories,
        {
          id,
          name: input.name,
          icon: input.icon ?? null,
          color: input.color ?? null,
          parentId: null,
          sortOrder: data.categories.length,
          customFields,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
    triggerAutoExport();
    return id;
  },

  async update(id: string, input: UpdateCategoryInput): Promise<void> {
    updateData((data) => ({
      ...data,
      categories: data.categories.map((c) => {
        if (c.id !== id) return c;
        const updated: any = {
          ...c,
          updatedAt: nowISO(),
        };
        if (input.name !== undefined) updated.name = input.name;
        if (input.icon !== undefined) updated.icon = input.icon;
        if (input.color !== undefined) updated.color = input.color;
        if (input.customFields !== undefined) {
          updated.customFields = input.customFields.map((f, i) => ({
            id: generateFieldId(),
            name: f.name,
            type: f.type,
            sortOrder: i,
          }));
        }
        return updated;
      }),
    }));
    triggerAutoExport();
  },

  async delete(id: string): Promise<void> {
    const deletedAt = nowISO();
    updateData((data) => ({
      ...data,
      categories: data.categories.filter((c) => c.id !== id),
      items: data.items.map((item) =>
        item.categoryId === id
          ? { ...item, categoryId: null, customValues: {}, updatedAt: deletedAt }
          : item
      ),
      deletedCategories: [
        ...data.deletedCategories.filter((tombstone) => tombstone.id !== id),
        { id, deletedAt },
      ],
    }));
    triggerAutoExport();
  },
};
