/**
 * 最小 PNG 编解码器 —— 物匣
 * ===========================
 *
 * 为什么自己写而不用 sharp / pngjs：
 *   新增依赖要过 scripts/check-dependency-matrix.js 的 Expo SDK 版本矩阵，
 *   而一个编解码器只值几十行、零供应链风险。编码方向（generate-textures.js
 *   产纸纹）与解码方向（重映射原图标）共用这一份实现。
 *
 * 支持范围够用即可：位深 8，色彩类型 0/2/3/6，非隔行。
 * **完整实现 5 种 scanline filter 的还原** —— 源图标用的是 filter 1，
 * 只支持 filter 0 读不出来。
 */

const zlib = require("zlib");

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

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/* ---------------------------------------------------------------- 编码 */

/**
 * 编码 8bit RGBA PNG。
 * 每行用 filter 0（None）：文件略大，但解码快、实现简单 —— 纹理图不必压到最小。
 */
function encodePng(width, height, rgba) {
  if (rgba.length !== width * height * 4) {
    throw new Error(`像素缓冲长度不符：期望 ${width * height * 4}，实际 ${rgba.length}`);
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type 6 = RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0; // interlace

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

/* ---------------------------------------------------------------- 解码 */

/** 每像素字节数：色彩类型 0=灰度 2=RGB 3=调色板 4=灰度+A 6=RGBA */
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/**
 * 还原 PNG 的 5 种 scanline filter。
 * filter 1(Sub) 2(Up) 3(Average) 4(Paeth) 都依赖已还原的左邻 / 上行像素，
 * 必须**按顺序原地**处理，不能整列并行。
 */
function defilter(raw, width, height, bytesPerPixel) {
  const stride = width * bytesPerPixel;
  const out = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y++) {
    const filterType = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const cur = y * stride;
    const prev = cur - stride;

    for (let i = 0; i < stride; i++) {
      const x = raw[src + i];
      // 左邻（同一行的前 bpp 字节）与上行（前一行的同一列）
      const a = i >= bytesPerPixel ? out[cur + i - bytesPerPixel] : 0;
      const b = y > 0 ? out[prev + i] : 0;
      const c = y > 0 && i >= bytesPerPixel ? out[prev + i - bytesPerPixel] : 0;

      let v;
      switch (filterType) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          // Paeth 预测器：取三个候选里离 p 最近的那个
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          throw new Error(`未知的 scanline filter：${filterType}`);
      }
      out[cur + i] = v & 0xff;
    }
  }
  return out;
}

/**
 * 解码 PNG → RGBA8888。
 * @returns {{width:number,height:number,data:Buffer}} data 长度 = width*height*4
 */
function decodePng(buf) {
  const SIG = "89504e470d0a1a0a";
  if (buf.slice(0, 8).toString("hex") !== SIG) throw new Error("不是 PNG 文件（签名不匹配）");

  let o = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  let interlace = 0;
  let palette = null;
  let trns = null;
  const idat = [];

  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.slice(o + 4, o + 8).toString("ascii");
    const data = buf.slice(o + 8, o + 8 + len);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "tRNS") {
      trns = data;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    o += 12 + len;
  }

  if (bitDepth !== 8) throw new Error(`只支持位深 8，实际 ${bitDepth}`);
  if (interlace !== 0) throw new Error("不支持隔行 PNG");
  const ch = CHANNELS[colorType];
  if (!ch) throw new Error(`不支持的色彩类型 ${colorType}`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const flat = defilter(raw, width, height, ch);

  // 统一成 RGBA
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0, n = width * height; i < n; i++) {
    const s = i * ch;
    const d = i * 4;
    if (colorType === 6) {
      data[d] = flat[s]; data[d + 1] = flat[s + 1]; data[d + 2] = flat[s + 2]; data[d + 3] = flat[s + 3];
    } else if (colorType === 2) {
      data[d] = flat[s]; data[d + 1] = flat[s + 1]; data[d + 2] = flat[s + 2]; data[d + 3] = 255;
    } else if (colorType === 0) {
      data[d] = data[d + 1] = data[d + 2] = flat[s]; data[d + 3] = 255;
    } else if (colorType === 4) {
      data[d] = data[d + 1] = data[d + 2] = flat[s]; data[d + 3] = flat[s + 1];
    } else {
      const p = flat[s] * 3;
      data[d] = palette[p]; data[d + 1] = palette[p + 1]; data[d + 2] = palette[p + 2];
      data[d + 3] = trns && flat[s] < trns.length ? trns[flat[s]] : 255;
    }
  }

  return { width, height, data };
}

module.exports = {
  CRC_TABLE,
  crc32,
  pngChunk,
  encodePng,
  defilter,
  decodePng,
  CHANNELS,
};

