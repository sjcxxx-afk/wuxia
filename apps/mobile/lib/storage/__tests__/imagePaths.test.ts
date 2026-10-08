import {
  imageExtensionOf,
  imageFileName,
  isAbsoluteImageUri,
  isInlineOrRemoteUri,
  normalizeImageExtension,
  rewriteImageReferences,
  toRelativeImageName,
  uniqueImageFileNames,
} from "../imagePaths";

test("normalizes every historical image path form to a relative name", () => {
  expect(toRelativeImageName("images/uuid.jpg")).toBe("images/uuid.jpg");
  expect(toRelativeImageName("file:///data/user/0/com.wuxia/files/images/uuid.jpg")).toBe("images/uuid.jpg");
  expect(toRelativeImageName("uuid.png")).toBe("images/uuid.png");
  expect(toRelativeImageName("https://example.com/a.jpg")).toBe("https://example.com/a.jpg");
  expect(toRelativeImageName("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  expect(toRelativeImageName("   ")).toBe("");
});

test("distinguishes absolute uris from persisted file names", () => {
  expect(isAbsoluteImageUri("file:///tmp/a.jpg")).toBe(true);
  expect(isAbsoluteImageUri("content://media/1")).toBe(true);
  expect(isAbsoluteImageUri("images/a.jpg")).toBe(false);
  expect(isInlineOrRemoteUri("data:image/png;base64,AAAA")).toBe(true);
  expect(isInlineOrRemoteUri("https://example.com/a.jpg")).toBe(true);
  expect(isInlineOrRemoteUri("file:///tmp/a.jpg")).toBe(false);
});

test("reads file names and extensions", () => {
  expect(imageFileName("images/uuid.webp")).toBe("uuid.webp");
  expect(imageFileName("file:///tmp/uuid.jpeg?x=1")).toBe("uuid.jpeg");
  expect(normalizeImageExtension("JPEG")).toBe(".jpg");
  expect(normalizeImageExtension(".webp")).toBe(".webp");
  expect(imageExtensionOf("images/uuid.PNG")).toBe(".png");
  expect(imageExtensionOf("images/uuid")).toBe(".jpg");
});

test("deduplicates referenced file names for the backup package", () => {
  expect(uniqueImageFileNames(["images/a.jpg", "images/a.jpg", "images/b.png"])).toEqual([
    "a.jpg",
    "b.png",
  ]);
});

test("rewrites image references and drops ones missing from the backup", () => {
  const mapping = new Map([
    ["a.jpg", "images/new-a.jpg"],
    ["b.png", "images/new-b.png"],
  ]);
  const items = rewriteImageReferences(
    [
      { id: "i1", images: ["images/a.jpg", "images/b.png"] },
      { id: "i2", images: ["images/missing.jpg"] },
      { id: "i3" },
    ],
    mapping
  );
  expect(items[0].images).toEqual(["images/new-a.jpg", "images/new-b.png"]);
  expect(items[1].images).toEqual([]);
  expect(items[2].images).toEqual([]);
});
