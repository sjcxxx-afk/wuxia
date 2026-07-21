jest.mock("expo-file-system/legacy", () => ({}));
jest.mock("../syncSettings", () => ({ isAutoSyncOn: () => false, getSyncFolderPath: () => "", getSyncMode: () => "every_change" }));

let mockCache: any;
jest.mock("../jsonStore", () => ({
  loadData: jest.fn(async () => mockCache),
  updateData: jest.fn((updater: (value: any) => any) => { mockCache = updater(mockCache); return mockCache; }),
  flushData: jest.fn(async () => undefined),
  normalizeWarehouseData: (value: unknown) => value,
  nowISO: () => "2026-07-20T00:00:00.000Z",
}));

import { mergeRemoteIntoLocal } from "../syncService";

const item = (id: string, updatedAt: string) => ({ id, updatedAt, name: id });
const category = (id: string, updatedAt: string) => ({ id, updatedAt, name: id });

beforeEach(() => {
  mockCache = {
    version: 2, lastModified: "2026-01-01T00:00:00.000Z", profile: { nickname: "", avatarUrl: null },
    items: [item("local", "2026-01-01T00:00:00.000Z")], categories: [category("cat", "2026-01-01T00:00:00.000Z")],
    deletedItems: [], deletedCategories: [],
  };
});

test("keeps the newer record when both devices changed it", async () => {
  await mergeRemoteIntoLocal({ ...mockCache, lastModified: "2026-02-01T00:00:00.000Z", items: [item("local", "2026-02-01T00:00:00.000Z")], deletedItems: [], deletedCategories: [] });
  expect(mockCache.items[0].updatedAt).toBe("2026-02-01T00:00:00.000Z");
});

test("a newer tombstone removes a stale local record", async () => {
  await mergeRemoteIntoLocal({ ...mockCache, items: [], deletedItems: [{ id: "local", deletedAt: "2026-02-01T00:00:00.000Z" }], deletedCategories: [] });
  expect(mockCache.items).toEqual([]);
  expect(mockCache.deletedItems).toEqual([{ id: "local", deletedAt: "2026-02-01T00:00:00.000Z" }]);
});

test("a newer record wins over an old deletion tombstone", async () => {
  mockCache.deletedItems = [{ id: "remote", deletedAt: "2026-01-01T00:00:00.000Z" }];
  await mergeRemoteIntoLocal({ ...mockCache, items: [item("remote", "2026-02-01T00:00:00.000Z")], deletedItems: [] });
  expect(mockCache.items.find((entry: any) => entry.id === "remote")).toBeTruthy();
});
