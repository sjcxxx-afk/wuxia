/** 图标预览器：把 lib/icons.ts 的形状渲染成 PNG，用肉眼验证，而不是靠「坐标算得对」。 */
const fs = require("fs");
const path = require("path");
const { encodePng } = require("./png-codec");
const ROOT = path.resolve(__dirname, "..");

function arcToCenter(x1, y1, rx, ry, phiDeg, laf, sf, x2, y2) {
  const phi = (phiDeg * Math.PI) / 180, cP = Math.cos(phi), sP = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const xp = cP * dx + sP * dy, yp = -sP * dx + cP * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
  const sign = laf === sf ? -1 : 1;
  const nu = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
  const de = rx * rx * yp * yp + ry * ry * xp * xp;
  const co = sign * Math.sqrt(Math.max(0, nu / de));
  const cxp = (co * rx * yp) / ry, cyp = (-co * ry * xp) / rx;
  const cx = cP * cxp - sP * cyp + (x1 + x2) / 2, cy = sP * cxp + cP * cyp + (y1 + y2) / 2;
  const t1 = Math.atan2((yp - cyp) / ry, (xp - cxp) / rx);
  let dt = Math.atan2((-yp - cyp) / ry, (-xp - cxp) / rx) - t1;
  if (!sf && dt > 0) dt -= 2 * Math.PI;
  if (sf && dt < 0) dt += 2 * Math.PI;
  return { cx, cy, rx, ry, t1, dt };
}

function sampleArc(o, x1, y1, rx, ry, rot, la, sf, x2, y2) {
  const a = arcToCenter(x1, y1, rx, ry, rot, la, sf, x2, y2);
  const n = Math.max(10, Math.ceil((Math.abs(a.dt) / Math.PI) * 40));
  for (let i = 1; i <= n; i++) {
    const t = a.t1 + (a.dt * i) / n;
    o.push(i === n ? [x2, y2] : [a.cx + a.rx * Math.cos(t), a.cy + a.ry * Math.sin(t)]);
  }
}

function cubic(o, x0, y0, x1, y1, x2, y2, x3, y3) {
  for (let i = 1; i <= 28; i++) {
    const t = i / 28, m = 1 - t;
    const a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
    o.push([a * x0 + b * x1 + c * x2 + d * x3, a * y0 + b * y1 + c * y2 + d * y3]);
  }
}

function flatten(d) {
  const tk = d.match(/[MLHVACZmlhvacz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  const subs = []; let cur = null, x = 0, y = 0, sx = 0, sy = 0, i = 0, cmd = null;
  const n = () => parseFloat(tk[i++]);
  const open = () => { cur = [[x, y]]; subs.push(cur); };
  while (i < tk.length) {
    const t = tk[i];
    if (/^[MLHVACZmlhvacz]$/.test(t)) {
      cmd = t; i++;
      if (cmd === "Z" || cmd === "z") {
        if (cur && cur.length) cur.push([sx, sy]);
        x = sx; y = sy; cmd = null; continue;
      }
      if (cmd === "M" || cmd === "m") {
        const nx = n(), ny = n();
        x = cmd === "m" ? x + nx : nx; y = cmd === "m" ? y + ny : ny;
        sx = x; sy = y; open(); cmd = cmd === "m" ? "l" : "L";
      } else if (!cur) open(); // 只有缺 M 起始时才补开子路径。
      // 原先是无条件 open()，导致每条 A/C/L 指令都被拆成独立子路径，
      // 闭合路径的首尾比较因此完全错位（几何守卫一上来就误报满屏）。
      continue;
    }
    if (cmd === "L" || cmd === "l") { const nx = n(), ny = n(); x = cmd === "l" ? x + nx : nx; y = cmd === "l" ? y + ny : ny; cur.push([x, y]); }
    else if (cmd === "H" || cmd === "h") { const nx = n(); x = cmd === "h" ? x + nx : nx; cur.push([x, y]); }
    else if (cmd === "V" || cmd === "v") { const ny = n(); y = cmd === "v" ? y + ny : ny; cur.push([x, y]); }
    else if (cmd === "C" || cmd === "c") {
      const r = cmd === "c", a = [n(), n(), n(), n(), n(), n()];
      const p = r ? [x + a[0], y + a[1], x + a[2], y + a[3], x + a[4], y + a[5]] : a;
      cubic(cur, x, y, p[0], p[1], p[2], p[3], p[4], p[5]); x = p[4]; y = p[5];
    } else if (cmd === "A" || cmd === "a") {
      const rx = n(), ry = n(), rot = n(), la = n(), sf = n(), nx = n(), ny = n();
      const ex = cmd === "a" ? x + nx : nx, ey = cmd === "a" ? y + ny : ny;
      sampleArc(cur, x, y, rx, ry, rot, la, sf, ex, ey); x = ex; y = ey;
    }
  }
  return subs.filter((s) => s.length > 1);
}

function sdSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const l2 = vx * vx + vy * vy;
  let t = l2 > 0 ? (wx * vx + wy * vy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(wx - vx * t, wy - vy * t);
}

function stroke(buf, W, sc, ox, oy, subs, sw, rgb) {
  const half = sw / 2, R = Math.ceil(sw) + 2;
  for (const sp of subs) {
    let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
    for (const p of sp) { mnx = Math.min(mnx, p[0]); mny = Math.min(mny, p[1]); mxx = Math.max(mxx, p[0]); mxy = Math.max(mxy, p[1]); }
    const x0 = Math.max(0, Math.floor(ox + mnx * sc - R)), x1 = Math.min(W - 1, Math.ceil(ox + mxx * sc + R));
    const y0 = Math.max(0, Math.floor(oy + mny * sc - R)), y1 = Math.min(W - 1, Math.ceil(oy + mxy * sc + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - ox) / sc, dy = (y + 0.5 - oy) / sc;
      let best = 1e9;
      for (let k = 0; k < sp.length - 1; k++) {
        const dd = sdSeg(dx, dy, sp[k][0], sp[k][1], sp[k + 1][0], sp[k + 1][1]);
        if (dd < best) best = dd;
      }
      const cov = Math.max(0, Math.min(1, 0.5 - (best - half) / sc));
      if (cov <= 0) continue;
      const idx = (y * W + x) * 4, da = buf[idx + 3] / 255, keep = da * (1 - cov), oa = cov + keep;
      for (let k = 0; k < 3; k++) buf[idx + k] = Math.round((rgb[k] * cov + buf[idx + k] * keep) / oa);
      buf[idx + 3] = Math.round(oa * 255);
    }
  }
}

function renderIcon(def, px, sw, rgb) {
  const buf = Buffer.alloc(px * px * 4);
  const sc = px / 24;
  for (const d of def.paths || []) stroke(buf, px, sc, 0, 0, flatten(d), sw, rgb);
  return buf;
}

function sheet(entries, cell, cols, gap) {
  const rows = Math.ceil(entries.length / cols);
  const rowH = cell * 2 + gap * 3;
  const W = cols * (cell + gap) + gap, H = rows * rowH + gap;
  const sh = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    sh[i * 4] = 242; sh[i * 4 + 1] = 237; sh[i * 4 + 2] = 228; sh[i * 4 + 3] = 255;
  }
  entries.forEach((e, idx) => {
    const bx = gap + (idx % cols) * (cell + gap), by = gap + Math.floor(idx / cols) * rowH;
    // 选中态 = 默认笔画 + 额外笔画（与应用实际渲染一致），而不是只画差量
    const passes = [
      { def: e.def, rgb: [43, 39, 35], dy: 0, sw: 1.7 },
      {
        def: { paths: e.def.paths.concat(e.def.active || []) },
        rgb: [142, 43, 33],
        dy: cell + gap * 2,
        sw: 1.95,
      },
    ];
    for (const p of passes) {
      const sub = renderIcon(p.def, cell, p.sw, p.rgb);
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
        const si = (y * cell + x) * 4, sa = sub[si + 3] / 255;
        if (sa <= 0) continue;
        const di = ((by + p.dy + y) * W + bx + x) * 4, da = sh[di + 3] / 255;
        const keep = da * (1 - sa), oa = sa + keep;
        for (let k = 0; k < 3; k++) sh[di + k] = Math.round((sub[si + k] * sa + sh[di + k] * keep) / oa);
        sh[di + 3] = Math.round(oa * 255);
      }
    }
  });
  return { buf: sh, W, H };
}

function extract() {
  const src = fs.readFileSync(path.join(ROOT, "lib/icons.ts"), "utf8");
  const out = [];
  const re = /const\s+(\w+)\s*:\s*IconDef\s*=\s*\{([\s\S]*?)\n\};/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const pick = (k) => {
      const mm = m[2].match(new RegExp(k + "\\s*:\\s*\\[([\\s\\S]*?)\\]"));
      return mm ? (mm[1].match(/"[^"]*"/g) || []).map((s) => s.slice(1, -1)) : [];
    };
    out.push({ name: m[1], def: { paths: pick("paths"), active: pick("active") } });
  }
  return out;
}

/** 最近邻放大，用于「贴近真实尺寸」检查：小尺寸下笔画会不会糊在一起 */
function upscale(src, w, h, k) {
  const W = w * k, H = h * k;
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const si = (Math.floor(y / k) * w + Math.floor(x / k)) * 4;
      const di = (y * W + x) * 4;
      for (let c = 0; c < 4; c++) out[di + c] = src[si + c];
    }
  }
  return { buf: out, W, H };
}

/**
 * 几何守卫：能自动化的部分。
 *
 * 抓三类真会出问题的错误：
 *   1. 采样点越出 24 视图框 —— 会被裁切，笔画断头
 *   2. 图标没有任何路径
 *   3. 退化路径（采样后长度≈0，形如 M4 12 L4 12）—— 画不出任何东西，白占一个图标位
 *
 * **刻意不检查的**：闭合性。解析器遇到 Z 会把起点补回末点（这正是 SVG 的语义，
 * 渲染时也一样），所以「首尾差」恒为 0 —— 写这条检查等于写一个永远通过的断言。
 * 「好不好看、会不会在 25px 糊成一团」是审美判断，只能靠
 * `npm run icons:preview` 出图人眼确认，不要假装能自动判定。
 */
function checkGeometry(entries) {
  const problems = [];
  const LIMIT = 23.6; // 留 0.4 给 round 描边的半径

  for (const e of entries) {
    const all = (e.def.paths || []).concat(e.def.active || []);
    if (!e.def.paths || !e.def.paths.length) {
      problems.push(e.name + " 没有任何路径");
      continue;
    }
    for (const d of all) {
      const subs = flatten(d);
      if (!subs.length) {
        problems.push(e.name + " 的路径采样不出几何：" + d.slice(0, 40));
        continue;
      }
      for (const sp of subs) {
        let len = 0;
        for (let k = 0; k < sp.length - 1; k++) {
          len += Math.hypot(sp[k + 1][0] - sp[k][0], sp[k + 1][1] - sp[k][1]);
        }
        if (len < 0.05) {
          problems.push(e.name + " 含退化路径（长度≈0，画不出东西）：" + d.slice(0, 40));
        }
        for (const p of sp) {
          if (p[0] < -LIMIT || p[0] > 48 - LIMIT || p[1] < -LIMIT || p[1] > 48 - LIMIT) {
            problems.push(
              e.name + " 采样点越出视图框：" + p[0].toFixed(1) + "," + p[1].toFixed(1) +
                "（允许范围 0~24）",
            );
            break;
          }
        }
      }
    }
  }
  return problems;
}

function main() {
  const entries = extract();
  if (!entries.length) { console.error("[icon-preview] 未提取到图标定义"); return 1; }

  // --check：只跑几何断言，不生成图（供 npm run check 使用）
  if (process.argv.includes("--check")) {
    const problems = checkGeometry(entries);
    if (problems.length) {
      console.error("[icons] 图标几何有问题：");
      for (const p of problems) console.error("  x " + p);
      return 1;
    }
    console.log(
      "[icons] 通过：" + entries.length +
        " 个图标几何正常（无越界 / 无空路径 / 无退化路径）。" +
        "形状好不好看请跑 npm run icons:preview 出图确认。",
    );
    return 0;
  }

  const cell = 96, cols = Math.min(8, entries.length);
  const s = sheet(entries, cell, cols, 14);
  const out = path.join(ROOT, "logs/icon-preview.png");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, encodePng(s.W, s.H, s.buf));
  console.log("[icon-preview] " + s.W + "x" + s.H + " -> " + out);
  console.log("[icon-preview] 每格 上=默认态 下=选中态(朱砂)：");
  entries.forEach((e, i) => console.log("  " + String(i).padStart(2) + ": 行" + (Math.floor(i / cols) + 1) + " 列" + ((i % cols) + 1) + " = " + e.name));

  // 真实尺寸版：25px（导航栏实际图标边长）渲染后放大 8 倍，
  // 用来检查小尺寸下笔画是否粘连、轮廓是否还读得出来。
  const real = 25;
  const rs = sheet(entries, real, cols, 10);
  const up = upscale(rs.buf, rs.W, rs.H, 8);
  const out2 = path.join(ROOT, "logs/icon-preview-25px.png");
  fs.writeFileSync(out2, encodePng(up.W, up.H, up.buf));
  console.log("[icon-preview] 真实尺寸 25px（放大 8 倍）-> " + out2);
  return 0;
}

module.exports = { flatten, extract, sheet, renderIcon, checkGeometry };
if (require.main === module) process.exit(main());
