#!/usr/bin/env node
/**
 * 宣纸纹理生成器 —— 物匣
 * =========================
 *
 * 为什么用脚本生成，而不是往仓库里丢两张 PNG：
 *   1. 纹理必须**可平铺**。PNG 贴错了锯齿在代码评审里看不出来，
 *      贴到屏幕上才暴露接缝；这里能本地确定性复现。
 *   2. 不往 git 里塞二进制：可 diff、可复算、可校验（--check）。
 *   3. **零依赖**：手写 PNG 编码器 + Node 内置 zlib。刻意不引 sharp / pngjs ——
 *      那会踩 scripts/check-dependency-matrix.js 的版本矩阵守卫，也拖慢 CI。
 *
 * 为什么只有纸纹走位图、木纹不走：
 *   木纹是**有方向的线条**，拉伸到全屏必然模糊失真，所以木纹走矢量绘制
 *   （components/Texture/WoodGrain.tsx）；纸纹是细密无方向的颗粒，才适合平铺。
 *
 * 用法：
 *   node scripts/generate-textures.js           # 生成到 assets/textures/
 *   node scripts/generate-textures.js --check   # 校验磁盘文件与生成结果是否一致
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

/* ============================================================ PNG 编码 */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** 组装 PNG chunk：长度(4) + 类型(4) + 数据 + CRC32(类型+数据) */
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/**
 * 编码 8bit RGBA PNG。
 * @param {number} width
 * @param {number} height
 * @param {Buffer} rgba 长度必须是 width*height*4
 */
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type 6 = RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // 每行前置一个 filter 字节（0 = None）。文件会略大，
  // 但解码快、实现简单，比自己实现 Paeth 划算 —— 纹理图不需要压到最小。
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ================================================== 可平铺的值噪声 fBm */

const fade = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

function hash2(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/**
 * 二维值噪声，**格点周期化** —— 这是能无缝平铺的关键。
 * 取模保证越过 period 时命中同一格点，因此左右/上下接缝天然对齐。
 * periodX / periodY 分开，才能做出「横向拉长的纤维」这类各向异性纹理。
 */
function valueNoise(x, y, periodX, periodY, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = fade(x - xi);
  const v = fade(y - yi);
  const wrap = (n, p) => ((n % p) + p) % p;
  const x0 = wrap(xi, periodX);
  const x1 = wrap(xi + 1, periodX);
  const y0 = wrap(yi, periodY);
  const y1 = wrap(yi + 1, periodY);
  return lerp(
    lerp(hash2(x0, y0, seed), hash2(x1, y0, seed), u),
    lerp(hash2(x0, y1, seed), hash2(x1, y1, seed), u),
    v,
  );
}

/** 分形叠加。每层周期翻倍，因此整段噪声仍在同一 tile 上闭合。 */
function fbm(x, y, periodX, periodY, octaves, seed, gain = 0.5) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * f, y * f, periodX * f, periodY * f, seed + o * 101);
    norm += amp;
    amp *= gain;
    f *= 2;
  }
  return sum / norm;
}

/* ============================================================ 纹理定义 */

/** 暖褐色偏墨 —— 纸纹颗粒的固有色，以低 alpha 叠在宣纸底上。 */
const PAPER_INK = [90, 74, 56];

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

/**
 * 宣纸细纹 —— 细密、无方向。
 * alpha 上限压到 16/255 ≈ 6.3%，守住 theme.texture.paperMaxOpacity（6%）。
 * 阈值取 0.45 而非 0.52：fBm 的直方图集中在 0.5 附近，阈值偏高会让
 * 绝大多数像素为 0，实测平均 alpha 只剩 0.4%，纹理等于白做。
 */
function paperFine(size, seed) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm((x / size) * 64, (y / size) * 64, 64, 64, 4, seed);
      // 把中段噪声拉成稀疏深色斑点，而不是一片均匀灰
      const a = Math.max(0, (n - 0.45) / 0.55) * 16;
      const i = (y * size + x) * 4;
      rgba[i] = PAPER_INK[0];
      rgba[i + 1] = PAPER_INK[1];
      rgba[i + 2] = PAPER_INK[2];
      rgba[i + 3] = clamp255(a);
    }
  }
  return rgba;
}

/**
 * 宣纸纤维 —— 横向拉长的条纹，模拟手工纸的纤维走向。
 * x 方向格点少、y 方向格点多 → 噪声被横向拉伸。
 */
function paperFiber(size, seed) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm((x / size) * 8, (y / size) * 96, 8, 96, 3, seed);
      const a = Math.max(0, (n - 0.48) / 0.52) * 13;
      const i = (y * size + x) * 4;
      rgba[i] = PAPER_INK[0];
      rgba[i + 1] = PAPER_INK[1];
      rgba[i + 2] = PAPER_INK[2];
      rgba[i + 3] = clamp255(a);
    }
  }
  return rgba;
}

/** 纹理清单集中登记：文件名 / 尺寸 / 生成函数 */
const TEXTURES = [
  { name: "paper-fine.png", size: 180, seed: 7, render: paperFine },
  { name: "paper-fiber.png", size: 180, seed: 23, render: paperFiber },
];

/* ============================================================== 主流程 */

function outputDir(projectRoot) {
  return path.join(projectRoot, "assets", "textures");
}

/** 确定性生成：同一份代码 + 同一个 seed 永远得到同样的字节 */
function build(texture) {
  const rgba = texture.render(texture.size, texture.seed);
  return encodePng(texture.size, texture.size, rgba);
}

function generate(projectRoot) {
  const dir = outputDir(projectRoot);
  fs.mkdirSync(dir, { recursive: true });
  const written = [];
  for (const t of TEXTURES) {
    const buf = build(t);
    const dest = path.join(dir, t.name);
    fs.writeFileSync(dest, buf);
    written.push({ name: t.name, bytes: buf.length });
  }
  return written;
}

/** 校验：磁盘上的文件必须与「现在这份代码会生成的字节」完全一致 */
function verify(projectRoot) {
  const dir = outputDir(projectRoot);
  const drift = [];
  for (const t of TEXTURES) {
    const dest = path.join(dir, t.name);
    if (!fs.existsSync(dest)) {
      drift.push(`${t.name}：文件不存在，请跑 node scripts/generate-textures.js`);
      continue;
    }
    const expected = build(t);
    const actual = fs.readFileSync(dest);
    if (!expected.equals(actual)) {
      drift.push(
        `${t.name}：与生成结果不一致（磁盘 ${actual.length}B vs 生成 ${expected.length}B）。` +
          `纹理生成器改了就必须重新生成并提交。`,
      );
    }
  }
  return drift;
}

function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const checkOnly = process.argv.includes("--check");

  if (checkOnly) {
    const drift = verify(projectRoot);
    if (drift.length > 0) {
      console.error("[textures] 纹理资产与生成器漂移：");
      for (const d of drift) console.error(`  ✗ ${d}`);
      console.error("\n  修复：跑 node scripts/generate-textures.js 并提交产物。");
      return 1;
    }
    console.log(`[textures] 通过：${TEXTURES.length} 张纸纹与生成器一致（可无缝平铺）。`);
    return 0;
  }

  const written = generate(projectRoot);
  console.log("[textures] 已生成到 assets/textures/：");
  for (const w of written) console.log(`  · ${w.name}  ${(w.bytes / 1024).toFixed(1)} KB`);
  return 0;
}

module.exports = {
  CRC_TABLE,
  crc32,
  pngChunk,
  encodePng,
  hash2,
  valueNoise,
  fbm,
  paperFine,
  paperFiber,
  TEXTURES,
  build,
  generate,
  verify,
  outputDir,
};

if (require.main === module) {
  process.exit(main());
}
