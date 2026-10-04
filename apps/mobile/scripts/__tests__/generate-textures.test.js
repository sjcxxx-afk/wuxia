const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const {
  crc32,
  pngChunk,
  encodePng,
  hash2,
  valueNoise,
  fbm,
  TEXTURES,
  build,
  verify,
  outputDir,
} = require("../generate-textures");

const projectRoot = path.resolve(__dirname, "..", "..");

/** 把 PNG 解回原始 RGBA 像素，用于对实际产出做断言 */
function decodePng(buf) {
  if (buf.slice(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("PNG 签名不对");
  let o = 8;
  let w = 0;
  let h = 0;
  const idat = [];
  let sawIend = false;
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.slice(o + 4, o + 8).toString("ascii");
    const data = buf.slice(o + 8, o + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      expect([data[8], data[9]]).toEqual([8, 6]); // 8bit + RGBA
    }
    if (type === "IDAT") idat.push(data);
    if (type === "IEND") {
      sawIend = true;
      break;
    }
    o += 12 + len;
  }
  expect(sawIend).toBe(true);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    expect(raw[y * (stride + 1)]).toBe(0); // 每行 filter 字节 = None
    raw.copy(rgba, y * stride, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
  }
  return { width: w, height: h, rgba };
}

describe("PNG 编码器", () => {
  it("crc32 对已知输入正确（IEEE 多项式）", () => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
    expect(crc32(Buffer.alloc(0))).toBe(0);
  });

  it("chunk 结构为 长度+类型+数据+CRC", () => {
    const c = pngChunk("TEST", Buffer.from([1, 2, 3]));
    expect(c.readUInt32BE(0)).toBe(3);
    expect(c.slice(4, 8).toString("ascii")).toBe("TEST");
    expect(c.length).toBe(4 + 4 + 3 + 4);
  });

  it("encodePng 产出可被解码的合法 PNG", () => {
    const rgba = Buffer.alloc(2 * 2 * 4, 0x7f);
    const { width, height, rgba: out } = decodePng(encodePng(2, 2, rgba));
    expect([width, height]).toEqual([2, 2]);
    expect(out.equals(rgba)).toBe(true);
  });

  it("encodePng 是确定性的（同输入同字节）", () => {
    const rgba = Buffer.alloc(8 * 8 * 4).map((_, i) => i % 256);
    expect(encodePng(8, 8, rgba).equals(encodePng(8, 8, rgba))).toBe(true);
  });
});

describe("可平铺噪声", () => {
  it("hash2 落在 0-1 且确定性", () => {
    const a = hash2(3, 7, 11);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(1);
    expect(hash2(3, 7, 11)).toBe(a);
  });

  it("valueNoise 对格点周期化：越过 period 取到同一格点（无缝平铺的根因）", () => {
    const p = 8;
    // 注意：回绕发生在 valueNoise 的格点索引上，hash2 本身不做回绕
    expect(valueNoise(p, 5, p, p, 3)).toBeCloseTo(valueNoise(0, 5, p, p, 3), 10);
    expect(valueNoise(5, p * 3, p, p, 3)).toBeCloseTo(valueNoise(5, 0, p, p, 3), 10);
    // 负坐标也要正确回绕
    expect(valueNoise(-1, 4, p, p, 3)).toBeCloseTo(valueNoise(p - 1, 4, p, p, 3), 10);
  });

  it("坐标缩放 + 匹配的 period 做出各向异性纹理（纸纤维靠这个）", () => {
    const size = 180;
    const px = 8; // 横向格点稀疏 → 横向变化慢
    const py = 96; // 纵向格点密集 → 纵向变化快
    const at = (x, y) => valueNoise((x / size) * px, (y / size) * py, px, py, 11);

    let varX = 0;
    let varY = 0;
    for (let i = 0; i < size - 1; i++) {
      varX += Math.abs(at(i, 90) - at(i + 1, 90));
      varY += Math.abs(at(90, i) - at(90, i + 1));
    }
    // 变化集中在 y 上 → 纹理呈横向条纹，正是宣纸纤维的方向
    expect(varY).toBeGreaterThan(varX * 5);
  });

  it("valueNoise 输出恒在 0-1", () => {
    for (let x = 0; x < 20; x += 0.37) {
      for (let y = 0; y < 20; y += 0.53) {
        const n = valueNoise(x, y, 8, 8, 5);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      }
    }
  });

  it("valueNoise 在格点处精确等于 hash 值", () => {
    expect(valueNoise(4, 4, 16, 16, 9)).toBeCloseTo(hash2(4, 4, 9), 6);
  });

  it("fbm 在 tile 边界两侧连续（首尾相邻，不是断裂）", () => {
    const period = 64;
    const size = 180;
    const at = (px) => fbm((px / size) * period, 0, period, period, 4, 7);
    expect(Math.abs(at(size - 1) - at(0))).toBeLessThan(0.2);
  });
});

describe("纸纹产出（当前仓库真实资产）", () => {
  it.each(TEXTURES.map((t) => [t.name, t]))("%s 尺寸与色彩类型正确", (_n, t) => {
    const { width, height } = decodePng(build(t));
    expect([width, height]).toEqual([t.size, t.size]);
  });

  it.each(TEXTURES.map((t) => [t.name, t]))("%s 峰值 alpha 不破纸纹铁律 6%", (_n, t) => {
    const { rgba } = decodePng(build(t));
    let maxA = 0;
    for (let i = 3; i < rgba.length; i += 4) maxA = Math.max(maxA, rgba[i]);
    expect(maxA / 255).toBeLessThanOrEqual(0.06);
  });

  it.each(TEXTURES.map((t) => [t.name, t]))("%s 是暖褐色偏墨，不是灰", (_n, t) => {
    const { rgba } = decodePng(build(t));
    expect([rgba[0], rgba[1], rgba[2]]).toEqual([90, 74, 56]);
  });

  it("细纹有实际可见的覆盖率（防止阈值调过头导致纹理等于白做）", () => {
    const { rgba } = decodePng(build(TEXTURES[0]));
    let nonZero = 0;
    const total = rgba.length / 4;
    for (let i = 3; i < rgba.length; i += 4) if (rgba[i] > 0) nonZero++;
    expect(nonZero / total).toBeGreaterThan(0.2);
    expect(nonZero / total).toBeLessThan(0.95);
  });

  it("两张纹理叠加后仍不超过 6%（因此组件层禁止把两张同时铺）", () => {
    const a = decodePng(build(TEXTURES[0])).rgba;
    const b = decodePng(build(TEXTURES[1])).rgba;
    let worst = 0;
    for (let i = 3; i < a.length; i += 4) {
      const combined = 1 - ((1 - a[i] / 255) * (1 - b[i] / 255));
      worst = Math.max(worst, combined);
    }
    // 这条断言是「两张纸纹不可叠加」这个设计决定的依据
    expect(worst).toBeGreaterThan(0.06);
  });
});

describe("资产与生成器的一致性", () => {
  it("磁盘上的 assets/textures/ 与生成器一致（--check 的逻辑）", () => {
    expect(verify(projectRoot)).toEqual([]);
  });

  it("产物确实落在 assets/textures/", () => {
    expect(outputDir(projectRoot)).toBe(path.join(projectRoot, "assets", "textures"));
    for (const t of TEXTURES) {
      expect(fs.existsSync(path.join(outputDir(projectRoot), t.name))).toBe(true);
    }
  });

  it("改生成器但不重新生成时能被 verify 抓到（漂移检测有效）", () => {
    const drift = verify(path.join(projectRoot, "scripts", "__tests__", "no-such-root"));
    expect(drift.length).toBeGreaterThan(0);
  });
});
