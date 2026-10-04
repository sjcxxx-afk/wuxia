/**
 * 应用图标重映射 —— 物匣
 * ========================
 *
 * 背景：assets 下原有 4 张图字节完全相同，都是「白色画布 + 靛蓝圆角方块 +
 * 白色匣形字形」的占位图。靛蓝 #3936E7 与新的木墨色系直接冲突
 *（冷紫 × 暖木纹会发脏），必须换掉。
 *
 * 做法：不重新设计图形，而是**确定性地重映射颜色**：
 *   - 用「蓝色超出量」b - (r+g)/2 把靛蓝方块从白底里分离出来
 *   - 圆角半径由方块顶行跨度反推（圆角矩形在最顶一行恰好只覆盖 [x0+r, x1-r]）
 *   - 圆角矩形**内部**的浅色像素即字形遮罩（外部白角与白字形同色，只能靠几何区分）
 *   - 字形重新上墨，底换成宣纸
 *
 * 为什么不用 AI 重绘：用户明确选了「修复技术配置」而非「AI 重新生成品牌图形」。
 * 而且确定性脚本可复算、可评审、可回归。
 *
 * 源文件 assets/_icon-source.png 是原始占位图的**只读副本**：脚本读它、
 * 写出 icon/adaptive/monochrome，因此可反复重跑而不会自我侵蚀。
 *
 * 用法：node scripts/icons.js
 */

const fs = require("fs");
const path = require("path");
const { decodePng, encodePng } = require("./png-codec");

const SRC = "assets/_icon-source.png";
const OUT_ICON = "assets/icon.png";
const OUT_ADAPTIVE = "assets/adaptive-icon.png";
const OUT_MONO = "assets/adaptive-icon-monochrome.png";
const OUT_AVATAR = "assets/xialing-avatar.png";
const OUT_SPLASH_MARK = "assets/splash-mark.png";

/** 品牌色，与 lib/theme.ts 的 palette 逐字对应 */
const BRAND = {
  paperTop: [250, 247, 241], // #FAF7F1
  paper: [242, 237, 228], // #F2EDE4
  ink: [43, 39, 35], // #2B2723
  cinnabar: [176, 58, 46], // #B03A2E
  black: [0, 0, 0], // Android 13+ 主题图标由系统着色，必须纯黑
};

/** 靛蓝度：源图方块是 #3936E7，白底与白字形该值接近 0 */
function blueness(r, g, b) {
  return b - (r + g) / 2;
}

/** 圆角矩形内测判定 */
function insideRoundedRect(px, py, x0, y0, x1, y1, r) {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false;
  const cx = Math.min(Math.max(px, x0 + r), x1 - r);
  const cy = Math.min(Math.max(py, y0 + r), y1 - r);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

/**
 * 分析源图：分离出圆角方块的几何参数与字形遮罩。
 * 所有数值都从像素里量出来，不硬编码。
 */
function analyze(img) {
  const { width: W, height: H, data } = img;
  const at = (x, y) => {
    const i = (y * W + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };

  const INDIGO_THRESHOLD = 60;

  // 1. 靛蓝方块 bbox
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [r, g, b] = at(x, y);
      if (blueness(r, g, b) > INDIGO_THRESHOLD) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error("源图里找不到靛蓝方块，无法分析");

  // 2. 圆角半径：圆角矩形在最顶一行恰好只覆盖 [x0+r, x1-r]
  let left = -1;
  for (let x = x0; x <= x1; x++) {
    const [r, g, b] = at(x, y0);
    if (blueness(r, g, b) > INDIGO_THRESHOLD) {
      left = x;
      break;
    }
  }
  const radius = left - x0;
  if (radius <= 0) throw new Error("圆角半径量出来不是正数，源图可能不是圆角方形");

  // 3. 区分「外部白」与「字形白」。
  //    两者颜色完全相同，靠颜色无法区分 —— 但它们**不连通**：
  //    外部白区从画布边缘一路连通，字形白区被靛蓝包围。
  //    所以从画布边界对 bl < 阈值 的像素做洪泛填充，标出来的就是外部。
  //    （早先只用 insideRoundedRect 判断，会把 squircle 外缘那圈抗锯齿带
  //      误当成字形，导致包围盒算成整张画布。）
  const open = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const [r, g, b] = at(i % W, Math.floor(i / W));
    if (blueness(r, g, b) < INDIGO_THRESHOLD) open[i] = 1;
  }

  const outside = new Uint8Array(W * H);
  const stack = [];
  const pushIfOpen = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (!open[i] || outside[i]) return;
    outside[i] = 1;
    stack.push(i);
  };
  // 从四条边上的所有开口像素出发（角上的白角正是从这里进出的）
  for (let x = 0; x < W; x++) {
    pushIfOpen(x, 0);
    pushIfOpen(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    pushIfOpen(0, y);
    pushIfOpen(W - 1, y);
  }
  // 迭代式 DFS，避免百万级递归爆栈
  while (stack.length > 0) {
    const i = stack.pop();
    const x = i % W;
    const y = (i / W) | 0;
    pushIfOpen(x + 1, y);
    pushIfOpen(x - 1, y);
    pushIfOpen(x, y + 1);
    pushIfOpen(x, y - 1);
  }

  // 4. 字形遮罩 = 非靛蓝、且不在外部区
  const mask = new Float32Array(W * H);
  let gx0 = W;
  let gy0 = H;
  let gx1 = -1;
  let gy1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!open[i] || outside[i]) continue;
      if (!insideRoundedRect(x + 0.5, y + 0.5, x0, y0, x1, y1, radius)) continue;
      const [r, g, b] = at(x, y);
      // 连续覆盖率：抗锯齿边缘落在 0..1 之间，缩放后边缘依然平滑
      const cover = Math.max(0, Math.min(1, 1 - blueness(r, g, b) / INDIGO_THRESHOLD));
      if (cover <= 0) continue;
      mask[i] = cover;
      if (x < gx0) gx0 = x;
      if (x > gx1) gx1 = x;
      if (y < gy0) gy0 = y;
      if (y > gy1) gy1 = y;
    }
  }
  if (gx1 < 0) throw new Error("找不到字形：源图结构与预期不符");

  return {
    W,
    H,
    mask,
    square: { x0, y0, x1, y1, radius },
    glyph: { x0: gx0, y0: gy0, x1: gx1, y1: gy1, w: gx1 - gx0 + 1, h: gy1 - gy0 + 1 },
  };
}

/**
 * 区域平均重采样遮罩到目标尺寸。
 *
 * 刻意不用最近邻：字形是细笔画，最近邻缩放会让边缘出现台阶，
 * 在 1024px 的启动图标上非常显眼。区域平均等于对降采样做低通，
 * 放大时靠覆盖率插值补回细节，边缘保持平滑。
 */
function resampleAlpha(mask, srcW, srcH, box, outW, outH) {
  const out = new Float32Array(outW * outH);
  const scaleX = box.w / outW;
  const scaleY = box.h / outH;
  for (let oy = 0; oy < outH; oy++) {
    // 目标像素在源图里覆盖到的范围
    const sy0 = box.y0 + oy * scaleY;
    const sy1 = sy0 + scaleY;
    for (let ox = 0; ox < outW; ox++) {
      const sx0 = box.x0 + ox * scaleX;
      const sx1 = sx0 + scaleX;
      let sum = 0;
      let n = 0;
      for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) {
        if (y < 0 || y >= srcH) continue;
        for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
          if (x < 0 || x >= srcW) continue;
          sum += mask[y * srcW + x];
          n++;
        }
      }
      out[oy * outW + ox] = n > 0 ? sum / n : 0;
    }
  }
  return out;
}

/* __RENDER__ */

/* ---------------------------------------------------------------- 绘制 */

/**
 * 有向距离场（SDF）圆角矩形。返回负值表示在内部。
 * 用 SDF 而不是「按像素判断内外」，是为了拿**解析抗锯齿**：
 * 覆盖率 = clamp(0.5 - d, 0, 1)，边缘因此是连续过渡而非台阶。
 * 图标会被系统缩放到各种尺寸，台阶边缘在小尺寸下非常显眼。
 */
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

/** SDF 圆 */
function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

/** SDF 由覆盖率换算：d<=0 在内部，边界在 d=0 处，正好半个像素宽的过渡带 */
function coverage(d) {
  return Math.max(0, Math.min(1, 0.5 - d));
}

/**
 * 木匣标记 —— 与 lib/icons.ts 的 chest 同一套几何。
 *
 * 为什么不再复用原图字形：原图标是个带发光效果的立体公文包，
 * 颜色重映射后是一团糊状黑块（还带光晕），与水墨的线性语言冲突。
 * 匣形本来就只由圆角矩形构成，用 SDF 重画能得到干净、锐利、
 * 与应用内图标严格一致的标记。
 *
 * 坐标沿用 24×24 设计空间，再按 k 缩放到目标画布。
 */
function inkChestShapes(k, ox, oy) {
  const u = (v) => v * k;
  const cx = (v) => ox + u(v);
  return {
    // 盖：比身略宽，这是「匣」这个形最关键的识别特征
    lid: { sdf: sdRoundRect, cx: cx(12), cy: oy + u(8.0), hw: u(9.0), hh: u(2.4), r: u(1.6) },
    // 盖与身之间的缝隙：用纸色画一道，把两者分开，否则糊成一整块。
    // 刻意比盖子略窄（8.8 < 9.0），否则两侧会探出小耳朵。
    rim: { sdf: sdRoundRect, cx: cx(12), cy: oy + u(10.45), hw: u(8.8), hh: u(0.3), r: u(0.3) },
    // 身
    body: { sdf: sdRoundRect, cx: cx(12), cy: oy + u(15.7), hw: u(7.6), hh: u(5.3), r: u(1.8) },
    // 扣：先铺一圈纸色再压焦墨，于是扣上有纸色的描边，负形读得出来
    latchHalo: { sdf: sdRoundRect, cx: cx(12), cy: oy + u(15.7), hw: u(2.35), hh: u(2.45), r: u(0.9) },
    latch: { sdf: sdRoundRect, cx: cx(12), cy: oy + u(15.7), hw: u(1.7), hh: u(1.8), r: u(0.6) },
  };
}

/**
 * 渲染图标。
 * @param size     输出边长
 * @param ratio    标记边长占画布的比例
 * @param inkColor 标记颜色
 * @param bg       null = 透明底；否则 [topRGB, bottomRGB] 竖向渐变
 */
function renderIcon(size, ratio, inkColor, bg) {
  const out = Buffer.alloc(size * size * 4);
  // 光学居中：标记重心略高于几何中心才显得居中
  const k = (size * ratio) / 24;
  const ox = (size - 24 * k) / 2;
  const oy = (size - 24 * k) / 2 - size * 0.012;
  const s = inkChestShapes(k, ox, oy);

  /* 底：竖向宣纸渐变，或透明 */
  if (bg) {
    for (let y = 0; y < size; y++) {
      const t = y / (size - 1);
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        out[i] = Math.round(bg[0][0] + (bg[1][0] - bg[0][0]) * t);
        out[i + 1] = Math.round(bg[0][1] + (bg[1][1] - bg[0][1]) * t);
        out[i + 2] = Math.round(bg[0][2] + (bg[1][2] - bg[0][2]) * t);
        out[i + 3] = 255;
      }
    }
  }

  /**
   * 把一个形状按覆盖率合成进缓冲。
   * mode = "over"  正常叠加（source-over）
   * mode = "erase" 擦除（destination-out）—— 透明底上用来挖出负形；
   *               有底色时退化为「用底色画」，效果与挖除一致。
   */
  const composite = (shape, color, mode) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = shape.sdf(x + 0.5, y + 0.5, shape.cx, shape.cy, shape.hw, shape.hh, shape.r);
        const cov = coverage(d);
        if (cov <= 0) continue;
        const i = (y * size + x) * 4;
        const dstA = out[i + 3] / 255;
        const keep = dstA * (1 - cov);
        // erase 是纯 destination-out（只动 alpha），over 是常规 source-over
        const outA = mode === "erase" ? keep : cov + keep;
        if (outA <= 0) continue;
        for (let c = 0; c < 3; c++) {
          out[i + c] = Math.round((color[c] * cov + out[i + c] * keep) / outA);
        }
        out[i + 3] = Math.round(outA * 255);
      }
    }
  };

  // 绘制顺序即叠压顺序：身 → 盖 → 盖缝 → 扣的纸色描边 → 扣
  composite(s.body, inkColor, "over");
  composite(s.lid, inkColor, "over");
  composite(s.rim, BRAND.paper, bg ? "over" : "erase");
  composite(s.latchHalo, BRAND.paper, bg ? "over" : "erase");
  composite(s.latch, inkColor, "over");

  return encodePng(size, size, out);
}

/**
 * 画出木匣标记的四个形状（供测试断言几何，不直接返回像素）。
 * 单独暴露是为了让单测能验证「盖比身宽」这类设计约束。
 */
function chestShapesForTest(size, ratio) {
  const k = (size * ratio) / 24;
  return inkChestShapes(k, (size - 24 * k) / 2, (size - 24 * k) / 2);
}

/**
 * 匣灵头像 —— 朱砂印。
 *
 * app/(tabs)/search/qa.tsx 用 assets/xialing-avatar.png 作匣灵（AI 助手）的头像。
 * 原文件其实与应用图标字节相同（占位符残留），靛蓝底与木墨冲突。
 * 匣灵是「钤印」的角色，用朱砂印做头像正好扣住品牌：全局唯一高彩度色，
 * 在现实里就是印泥。形状仍是 SDF 圆，解析抗锯齿。
 */
function renderSeal(size) {
  const out = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const shapes = [
    // 外圈：朱砂印面
    { r: size * 0.46, color: BRAND.cinnabar },
    // 内圈：宣纸留白，形成一道环
    { r: size * 0.34, color: BRAND.paperTop },
    // 印心：焦墨点
    { r: size * 0.13, color: BRAND.ink },
  ];

  for (const s of shapes) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cov = coverage(sdCircle(x + 0.5, y + 0.5, c, c, s.r));
        if (cov <= 0) continue;
        const i = (y * size + x) * 4;
        const dstA = out[i + 3] / 255;
        const keep = dstA * (1 - cov);
        const outA = cov + keep;
        for (let k = 0; k < 3; k++) {
          out[i + k] = Math.round((s.color[k] * cov + out[i + k] * keep) / outA);
        }
        out[i + 3] = Math.round(outA * 255);
      }
    }
  }
  return encodePng(size, size, out);
}

function main() {
  const projectRoot = path.resolve(__dirname, "..");

  const files = [
    {
      out: OUT_ICON,
      buf: renderIcon(1024, 0.7, BRAND.ink, [BRAND.paperTop, BRAND.paper]),
      note: "启动器图标：宣纸竖向渐变底 + 焦墨木匣",
    },
    {
      out: OUT_ADAPTIVE,
      // Android 自适应图标的安全区是中心 66%，0.6 留足余量
      buf: renderIcon(1024, 0.6, BRAND.ink, null),
      note: "自适应图标前景：透明底 + 焦墨木匣（形状由系统裁切）",
    },
    {
      out: OUT_MONO,
      buf: renderIcon(1024, 0.6, BRAND.black, null),
      note: "Android 13+ 主题图标：透明底 + 纯黑木匣（由系统着色）",
    },
    {
      out: OUT_AVATAR,
      buf: renderSeal(512),
      note: "匣灵头像：朱砂印（search/qa.tsx 的欢迎态使用）",
    },
    {
      // 启动页标记：**必须透明底**。
      // expo-splash-screen 的 config plugin 会把它当作 windowSplashScreenAnimatedIcon
      // 叠在 backgroundColor 之上；早先这里用的是满幅应用图标，于是它在纯色底上
      // 显示成一个带圆角的方块 —— 即「方块套方块」。
      // 另一层作用：插件在 withAndroidSplashStyles 里**无条件**写
      // @drawable/splashscreen_logo，而只有配了 image 才会生成该 drawable。
      // 省略 image 会让 AAPT2 直接报 "resource drawable/splashscreen_logo not found"，
      // release 构建挂在 :app:processReleaseResources。所以这张图是必需的。
      out: OUT_SPLASH_MARK,
      buf: renderIcon(1024, 0.66, BRAND.ink, null),
      note: "启动页标记：透明底 + 焦墨木匣（叠在 app.json 的 splash backgroundColor 之上）",
    },
  ];

  for (const f of files) {
    fs.writeFileSync(path.join(projectRoot, f.out), f.buf);
    console.log(`  · ${f.out}  ${(f.buf.length / 1024).toFixed(1)} KB  ${f.note}`);
  }
  return 0;
}

module.exports = {
  BRAND,
  blueness,
  insideRoundedRect,
  analyze,
  resampleAlpha,
  sdRoundRect,
  sdCircle,
  coverage,
  inkChestShapes,
  chestShapesForTest,
  renderIcon,
  renderSeal,
};

if (require.main === module) {
  process.exit(main());
}
