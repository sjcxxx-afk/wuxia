jest.mock("expo-file-system/legacy", () => ({ documentDirectory: "file://warehouse/" }));

import { normalizeWarehouseData } from "../jsonStore";

test("migrates a v1 data file without deletion tombstones", () => {
  const migrated = normalizeWarehouseData({
    version: 1,
    lastModified: "2026-01-01T00:00:00.000Z",
    profile: { nickname: "匣主", avatarUrl: null },
    categories: [{ id: "c1", name: "数码", customFields: [] }],
    items: [{ id: "i1", name: "耳机", images: [], customValues: {} }],
  });
  expect(migrated.version).toBe(2);
  expect(migrated.deletedItems).toEqual([]);
  expect(migrated.deletedCategories).toEqual([]);
  expect(migrated.items[0].aiComment).toBeNull();
  expect(migrated.items[0]).toMatchObject({
    aiReviewStatus: "idle",
    aiReviewRequestId: null,
    aiReviewStartedAt: null,
    aiReviewError: null,
  });
});

test("rejects malformed imported data instead of treating it as empty data", () => {
  expect(() => normalizeWarehouseData({ profile: {}, items: "not-an-array", categories: [] })).toThrow("数据文件格式无效");
});
