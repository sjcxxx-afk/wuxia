jest.mock("expo-file-system/legacy", () => ({ documentDirectory: "file://warehouse/" }));

import { DATA_VERSION, normalizeWarehouseData } from "../jsonStore";

test("migrates a v1 data file to the current version", () => {
  const migrated = normalizeWarehouseData({
    version: 1,
    lastModified: "2026-01-01T00:00:00.000Z",
    profile: { nickname: "匣主", avatarUrl: null },
    categories: [{ id: "c1", name: "数码", customFields: [] }],
    items: [{ id: "i1", name: "耳机", images: [], customValues: {} }],
  });
  expect(migrated.version).toBe(DATA_VERSION);
  expect(migrated.items[0].aiComment).toBeNull();
  expect(migrated.items[0]).toMatchObject({
    aiReviewStatus: "idle",
    aiReviewRequestId: null,
    aiReviewStartedAt: null,
    aiReviewError: null,
  });
});

test("rewrites legacy absolute image paths to relative names", () => {
  const migrated = normalizeWarehouseData({
    version: 2,
    lastModified: "2026-01-01T00:00:00.000Z",
    profile: { nickname: "匣主", avatarUrl: null },
    categories: [],
    items: [
      {
        id: "i1",
        name: "耳机",
        images: [
          "file:///data/user/0/com.wuxia/files/images/uuid-a.jpg",
          "images/uuid-b.png",
          "uuid-c.webp",
          "file:///data/user/0/com.wuxia/files/images/uuid-a.jpg",
        ],
      },
    ],
  });
  expect(migrated.items[0].images).toEqual([
    "images/uuid-a.jpg",
    "images/uuid-b.png",
    "images/uuid-c.webp",
  ]);
});

test("keeps remote and inline image urls untouched", () => {
  const migrated = normalizeWarehouseData({
    version: 3,
    lastModified: "2026-01-01T00:00:00.000Z",
    profile: { nickname: "", avatarUrl: null },
    categories: [],
    items: [{ id: "i1", name: "耳机", images: ["https://example.com/a.jpg"] }],
  });
  expect(migrated.items[0].images).toEqual(["https://example.com/a.jpg"]);
});

test("rejects malformed imported data instead of treating it as empty data", () => {
  expect(() => normalizeWarehouseData({ profile: {}, items: "not-an-array", categories: [] })).toThrow("数据文件格式无效");
});
