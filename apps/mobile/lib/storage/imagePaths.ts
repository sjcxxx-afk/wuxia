/**
 * 图片路径工具 —— 纯函数，无原生依赖，便于单测与在数据层复用。
 *
 * 约定：JSON 中只保存相对名（`images/<uuid>.<ext>`），渲染与落盘时再拼当前设备的文档目录。
 * 绝对路径在换机、iOS 重装后都会失效，而相对名跨设备始终有效。
 */

export const IMAGES_DIR_NAME = "images";

/** data: / http(s): 这类地址指向的是内容本身，不属于本机文件。 */
const INLINE_OR_REMOTE_RE = /^(data|https?):/i;
/** 任何带 scheme 的地址（file:、content:、data:、http(s): …）。 */
const ANY_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

/** 是否为无需拼文档目录的地址（相册临时 URI、data URI、网络地址）。 */
export function isAbsoluteImageUri(value: string): boolean {
  return ANY_SCHEME_RE.test(String(value ?? "").trim());
}

/** 是否为指向内容本身的地址（不应写入磁盘路径）。 */
export function isInlineOrRemoteUri(value: string): boolean {
  return INLINE_OR_REMOTE_RE.test(String(value ?? "").trim());
}

/** 取路径中的文件名（同时兼容 Windows 风格分隔符与查询串）。 */
export function imageFileName(value: string): string {
  const trimmed = String(value ?? "").trim().replace(/\\/g, "/").split("?")[0];
  return trimmed.split("/").pop() ?? "";
}

/**
 * 把任意历史写法归一为 `images/<文件名>`：
 * 旧版本的绝对路径（`file:///…/images/uuid.jpg`）、裸文件名（`uuid.jpg`）、
 * 已是相对名的值原样返回；data:/http(s): 保持原样（无法落地为文件）。
 */
export function toRelativeImageName(value: string): string {
  const trimmed = String(value ?? "").trim().replace(/\\/g, "/");
  if (!trimmed) return "";
  if (INLINE_OR_REMOTE_RE.test(trimmed)) return trimmed;
  if (trimmed.startsWith(IMAGES_DIR_NAME + "/")) return trimmed;
  const base = imageFileName(trimmed);
  return base ? IMAGES_DIR_NAME + "/" + base : "";
}

/** 归一扩展名，未知类型按 .jpg 处理。 */
export function normalizeImageExtension(value: string): string {
  const ext = String(value ?? "").trim().toLowerCase().replace(/^\./, "");
  if (ext === "jpg" || ext === "jpeg") return ".jpg";
  if (ext === "png") return ".png";
  if (ext === "webp") return ".webp";
  return ".jpg";
}

/** 从路径/文件名中取归一后的扩展名。 */
export function imageExtensionOf(value: string): string {
  return normalizeImageExtension(imageFileName(value).split(".").pop() ?? "");
}

/** 去重并排序的文件名列表，用于备份包收集与孤儿图片清理。 */
export function uniqueImageFileNames(values: string[]): string[] {
  const names = new Set<string>();
  for (const value of values) {
    const name = imageFileName(value);
    if (name) names.add(name);
  }
  return [...names].sort();
}

/**
 * 按「备份包文件名 → 本机相对名」的映射改写图片引用。
 * 映射里没有的引用（图片在备份包里缺失）会被丢弃，避免留下打不开的死路径。
 */
export function rewriteImageReferences<T extends { images?: string[] }>(
  items: T[],
  mapping: Map<string, string>
): T[] {
  return items.map((item) => ({
    ...item,
    images: (item.images ?? [])
      .map((value) => mapping.get(imageFileName(value)))
      .filter((value): value is string => !!value),
  }));
}
