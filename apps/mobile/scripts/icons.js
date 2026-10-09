/**
 * 品牌图形派生 —— 物匣
 * =====================
 *
 * **唯一的设计源是 `assets/icon.png`** —— 那张「靛蓝圆角方块 + 白色开口木匣」
 * 的原始图标（匣盖上有一颗星光，两个靛蓝圆点是眼睛，中间白环是扣）。
 * 它由设计提供，是**只读输入**：本脚本绝不写出它。
 *
 * 脚本做的是从它派生出其余几项，让全应用的品牌形状保持一致：
 *   - adaptive-icon.png           白色字形，透明底（叠在 app.json 的靛蓝底上）
 *   - adaptive-icon-monochrome.png 黑色字形，透明底（Android 13+ 由系统着色）
 *   - splash-mark.png             靛蓝字形，透明底（叠在纸白启动页上）
 *
 * 为什么不手绘一套：曾经这样做过（SDF 绘制的极简木匣），结论是
 * 手绘图形远不如设计稿有辨识度，用户明确要求换回原图标。
 * 派生而不是重绘，才能保证「桌面上那个匣子」和「启动页那个匣子」是同一只。
 *
 * 字形提取原理（早期版本留下的机制，这里重新接上）：
 *   1. 用「蓝色超出量」b - (r+g)/2 分离出靛蓝方块，反推圆角半径；
 *   2. 画布外的白角与字形白**颜色完全相同**，靠颜色分不开 ——
 *      但两者不连通：从画布四边对「非靛蓝」像素做洪泛填充，标出的即外部白；
 *   3. 剩下的浅色像素就是字形，覆盖率取连续值，缩放后边缘依然平滑。
 *
 * 用法：node scripts/icons.js
 */

const fs = require("fs");
const path = require("path");
const { decodePng, encodePng } = require("./png-codec");

const projectRoot = path.resolve(__dirname, "..");

/** 设计源。只读，脚本永不写它。 */
const SRC = "assets/icon.png";
const OUT_ADAPTIVE = "assets/adaptive-icon.png";
const OUT_MONO = "assets/adaptive-icon-monochrome.png";
const OUT_AVATAR = "assets/xialing-avatar.png";
const OUT_SPLASH_MARK = "assets/splash-mark.png";

/**
 * 品牌色 —— 与 lib/theme.ts 的 palette 保持一致（纸白 + 靛蓝）。
 * 改了 theme 记得同步这里并重跑 npm run generate:icons。
 */
const BRAND = {
  /** 白色 —— 自适应图标前景（叠在靛蓝底上），与原图标的白匣同色 */
  white: [255, 255, 255],
  indigo: [79, 70, 229], // #4F46E5
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

/**
 * 从设计源提取字形，重上色后输出为**透明底** PNG。
 *
 * 这是本脚本的核心：所有品牌图都从同一只匣子派生，
 * 因此桌面图标、启动页、主题图标里的形状必然一致。
 *
 * @param size     输出边长
 * @param fitRatio 字形最长边占输出边长的比例（余量）
 * @param color    字形颜色 [r,g,b]
 */
function renderGlyph(size, fitRatio, color) {
  const src = decodePng(fs.readFileSync(path.join(projectRoot, SRC)));
  const a = analyze(src);

  // 字形按最长边适配，居中。留白比例由 fitRatio 控制。
  const target = size * fitRatio;
  const scale = Math.min(target / a.glyph.w, target / a.glyph.h);
  const gw = Math.max(1, Math.round(a.glyph.w * scale));
  const gh = Math.max(1, Math.round(a.glyph.h * scale));
  const mask = resampleAlpha(a.mask, a.W, a.H, a.glyph, gw, gh);

  const out = Buffer.alloc(size * size * 4);
  const ox = Math.round((size - gw) / 2);
  const oy = Math.round((size - gh) / 2);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const alpha = Math.max(0, Math.min(1, mask[y * gw + x]));
      if (alpha <= 0) continue;
      const di = ((oy + y) * size + ox + x) * 4;
      out[di] = color[0];
      out[di + 1] = color[1];
      out[di + 2] = color[2];
      out[di + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(size, size, out);
}

/* ---------------------------------------------------------------- 绘制 */

/**
 * 有向距离场（SDF）圆。返回负值表示在内部。
 * 用 SDF 而不是「按像素判断内外」，是为了拿**解析抗锯齿**：
 * 覆盖率 = clamp(0.5 - d, 0, 1)，边缘因此是连续过渡而非台阶。
 */

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

/** SDF 由覆盖率换算：d<=0 在内部，边界在 d=0 处，正好半个像素宽的过渡带 */
function coverage(d) {
  return Math.max(0, Math.min(1, 0.5 - d));
}

/**
 * 匣灵头像 —— 靛蓝同心圆标记。
 *
 * app/(tabs)/search/qa.tsx 用 assets/xialing-avatar.png 作匣灵（AI 助手）的头像。
 * 形状是 SDF 圆，解析抗锯齿：外圈靛蓝、内圈纸白形成一道环、中心一个小点。
 */
function renderSeal(size) {
  const out = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const shapes = [
    // 外圈：靛蓝
    { r: size * 0.46, color: BRAND.indigo },
    // 内圈：白留白，形成一道环
    { r: size * 0.34, color: BRAND.white },
    // 圆心：靛蓝点
    { r: size * 0.13, color: BRAND.indigo },
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

/**
 * 合成预览：把每张派生图叠在它**实际会被叠上去的底色**上排成一行，
 * 输出到 logs/brand-preview.png 供人眼确认。
 *
 * 为什么必需：自适应前景是白字形 + 透明底，白色查看器里完全看不见 ——
 * 不看合成结果就等于没验证。这条是上一轮「图标写完没看图就推送」的教训。
 */
function renderPreview() {
  const items = [
    { file: "assets/icon.png", bg: [255, 255, 255], note: "启动器图标（设计源，原样）" },
    { file: OUT_ADAPTIVE, bg: BRAND.indigo, note: "自适应前景 · 叠靛蓝底" },
    { file: OUT_MONO, bg: [250, 249, 247], note: "主题图标 · 叠纸白" },
    { file: OUT_SPLASH_MARK, bg: [250, 249, 247], note: "启动页标记 · 叠纸白" },
    { file: OUT_AVATAR, bg: [250, 249, 247], note: "匣灵头像" },
  ];
  const cell = 240;
  const gap = 16;
  const W = items.length * (cell + gap) + gap;
  const H = cell + gap * 2;
  const sheet = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    sheet[i * 4] = 236;
    sheet[i * 4 + 1] = 236;
    sheet[i * 4 + 2] = 236;
    sheet[i * 4 + 3] = 255;
  }

  items.forEach((it, idx) => {
    const img = decodePng(fs.readFileSync(path.join(projectRoot, it.file)));
    const bx = gap + idx * (cell + gap);
    const by = gap;
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        const sx = Math.min(img.width - 1, Math.floor((x / cell) * img.width));
        const sy = Math.min(img.height - 1, Math.floor((y / cell) * img.height));
        const si = (sy * img.width + sx) * 4;
        const a = img.data[si + 3] / 255;
        const di = ((by + y) * W + bx + x) * 4;
        for (let c = 0; c < 3; c++) {
          sheet[di + c] = Math.round(img.data[si + c] * a + it.bg[c] * (1 - a));
        }
        sheet[di + 3] = 255;
      }
    }
  });

  const out = path.join(projectRoot, "logs/brand-preview.png");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, encodePng(W, H, sheet));
  console.log(`[icons] 合成预览 ${W}x${H} -> logs/brand-preview.png`);
  items.forEach((it, i) => console.log(`  第${i + 1}格 ${it.note}`));
}

function main() {
  const files = [
    // 注意：assets/icon.png **不在产出列表里**。它是设计源，只读不写。
    {
      out: OUT_ADAPTIVE,
      // 自适应图标前景必须是透明底、且形状落在中心安全区内。
      // 底色由 app.json 的 adaptiveIcon.backgroundColor 提供（靛蓝 #4F46E5），
      // 所以前景用白色字形 —— 与原图标「靛蓝底 + 白匣」的观感一致。
      //
      // 取 0.54 而不是更大：部分启动器用**圆形**遮罩，安全区是中心 66%。
      // 这只匣子宽高比约 1.73:1，要让它的对角线也落进 66% 的圆内，
      // 宽度上限约 57%。0.54 既安全，又与原图里字形的占比一致。
      buf: renderGlyph(1024, 0.54, BRAND.white),
      note: "自适应图标前景：透明底 + 白色匣形（叠在靛蓝底上，形状由系统裁切）",
    },
    {
      out: OUT_MONO,
      // 与自适应前景同比例：两者会被系统放在同一遮罩下，比例不一致会「跳大小」
      buf: renderGlyph(1024, 0.54, BRAND.black),
      note: "Android 13+ 主题图标：透明底 + 纯黑匣形（由系统着色）",
    },
    {
      out: OUT_AVATAR,
      buf: renderSeal(512),
      note: "匣灵头像：靛蓝同心圆标记（search/qa.tsx 的欢迎态使用）",
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
      buf: renderGlyph(1024, 0.66, BRAND.indigo),
      note: "启动页标记：透明底 + 靛蓝标记（叠在 app.json 的 splash backgroundColor 之上）",
    },
  ];

  for (const f of files) {
    fs.writeFileSync(path.join(projectRoot, f.out), f.buf);
    console.log(`  · ${f.out}  ${(f.buf.length / 1024).toFixed(1)} KB  ${f.note}`);
  }

  // 顺带出合成预览——白字形不合成根本看不见，等于没验证
  console.log("");
  renderPreview();
  return 0;
}

module.exports = {
  BRAND,
  blueness,
  insideRoundedRect,
  analyze,
  resampleAlpha,
  sdCircle,
  coverage,
  renderGlyph,
  renderSeal,
  renderPreview,
};

if (require.main === module) {
  process.exit(main());
}
