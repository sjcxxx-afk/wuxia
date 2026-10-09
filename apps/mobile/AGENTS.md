# AGENTS.md — 物匣

## 品牌用语（用户可见文案）

| 用语 | 含义 |
|------|------|
| 物匣 | 产品本身 |
| 匣中 | 列表 / Tab |
| 匣物 | 单件收录之物 |
| 匣主 | 设置 / 资料 Tab |
| 匣灵 | AI 助手 |
| 入匣 / 改匣 | 新增 / 编辑 |

代码路由与类型仍用 `items` / `Item` / `profile`，不要为文案去改文件名。

## 项目结构（以仓库根为基准）

```
物匣/
├── .cnb.yml              ← CNB 流水线（发版构建主路径）
├── .cnb/                 ← CNB 工具链 Dockerfile 与手动触发按钮
├── .github/workflows/    ← GitHub Actions 备份流水线
├── .secrets/             ← 本地签名密钥（gitignore，绝不入库）
├── apps/mobile/          ← Expo 应用入口
│   ├── app/              ← expo-router 页面（文件路由）
│   ├── components/       ← 可复用 UI 组件
│   ├── lib/              ← 业务逻辑（types, storage, repositories, ocr, ai）
│   ├── scripts/          ← 构建期脚本（prebuild 后改原生配置）
│   ├── assets/           ← 静态资源（图标、启动图）
│   ├── package.json      ← Expo 项目入口（在此目录执行 npx expo start）
│   ├── app.json          ← Expo 配置（含 version / android.versionCode）
│   ├── tsconfig.json     ← TypeScript 配置
│   └── AGENTS.md         ← 本文件
├── docs/                 ← 项目文档
│   ├── PRD.md            ← 产品需求文档
│   └── SPEC.md           ← 技术规范文档
└── README.md             ← 项目整体说明
```

## 视觉体系：纸白 + 靛蓝（务必先读）

**极简、干净、不要纹理。** 视觉由「纸白底 + 灰黑文字 + 靛蓝强调」三档构成。

> 上一版是「木墨」（宣纸底 + 木纹 + 纸纹 + 墨晕 + 朱砂）。立意没错，
> 但真实设备上的反馈是「看着发黄、蒙灰，不如原来的蓝白好看」。
> 复盘结论：**问题出在纹理，不在概念**。木纹 / 纸纹 / 墨晕叠在界面上又碎又脏，
> 附加值远不及代价，于是连同组件与生成脚本一并删除。
> **不要再加贴图质感** —— 要层次就用间距、字重、阴影、留白。

### 铁律（违反即视为 bug）

1. **正文必须过 WCAG AA（4.5:1）**。`npm run check:theme` 会实测所有前景/背景组合，
   不要靠目测。改动 `lib/theme.ts` 的 palette 后必须重跑。
   换配色时 PAIRS 里的键名要一起改 —— 键名不匹配会**抛错**而不是静默跳过。
2. **不要硬编码色值**，一律取 `lib/theme.ts` 的语义令牌（`colors.*`）。

### 三档用色

| 角色 | 令牌 | 用在哪 |
|------|------|--------|
| 纸白 | `colors.background` / `surface` | 页面底、卡片、导航栏 |
| 灰黑 | `colors.text` / `textSecondary` / `textTertiary` | 所有文字，三级 |
| 靛蓝 | `colors.accent` | **唯一品牌色**：选中态、主操作、指示条 |

状态色 `success` / `warning` / `danger` 取的是能满足 AA 的深档，可直接当文字色用。
`textTertiary`（#6B7280）在纸白底上约 4.6:1，**几乎没有余量，不要再调浅**。

### 关键文件

| 文件 | 职责 |
|------|------|
| `lib/theme.ts` | 设计令牌唯一来源。色板 / 间距 / 圆角 / 阴影 / 字号 / 动效 |
| `lib/icons.ts` | 语义名 → Ionicons 字形名。新增图标在这里映射 |
| `components/Icon.tsx` | 图标组件。暴露**语义名**，选中态自动切 outline/filled |
| `components/InkSplash.tsx` | 启动页（纯纸白 + 图标 + 字标，无纹理） |
| `components/WoodTabBar.tsx` | 底部导航栏（纯白 + 靛蓝滑动指示条）。名字是历史遗留 |

### 图标

- 用 **Ionicons**，不要手写 SVG。上一版手绘过一套 24×24 路径，结论是
  手绘在造型统一性、光学修正、视觉重心上明显不如专业图标库
  （放大镜被两段大弧拼成尖椭圆、分类图标在 25px 下糊成一团）。
- 业务代码写 `<Icon name="chest" />`（语义名），**不要**写 `<Ionicons name="file-tray-full-outline" />`。
  字形全部收在 `lib/icons.ts`，换图标库只改那一个文件。
- 选中态用 `active` 属性切 Ionicons 的实心变体，不要自己做加粗或叠笔画。

### 品牌图形

**`assets/icon.png` 是唯一的设计源，而且是只读的。**
它是那张「靛蓝圆角方块 + 白色开口木匣」的原始图标（匣盖上有一颗星光，
两个靛蓝圆点是眼睛，中间白环是扣）。脚本**绝不写出它**。

其余品牌图都由它派生，保证「桌面上那个匣子」和「启动页那个匣子」是同一只：

```bash
npm run generate:icons   # 从设计源派生，并输出合成预览
```

| 产出 | 内容 |
|------|------|
| `adaptive-icon.png` | 白色字形 + 透明底（叠在 `app.json` 的 `adaptiveIcon.backgroundColor` 靛蓝上） |
| `adaptive-icon-monochrome.png` | 黑色字形 + 透明底（Android 13+ 由系统着色） |
| `splash-mark.png` | 靛蓝字形 + 透明底（叠在纸白启动页上） |
| `xialing-avatar.png` | 匣灵头像，SDF 绘制的靛蓝同心圆 |

- **不要手改这几张 PNG**，改形状要改设计源，改颜色要改 `scripts/icons.js` 的 `BRAND`。
- 自适应前景的比例固定在 **0.54**：部分启动器用圆形遮罩，安全区是中心 66%，
  这只匣子宽高比约 1.73:1，要让对角线也落进圆内，宽度上限约 57%。
  **别调大**，会被裁掉四角。
- 生成时会自动输出 `logs/brand-preview.png`（各图叠在**实际底色**上）。
  自适应前景是白字形，白色查看器里根本看不见 —— **不看合成结果等于没验证**。

> 历史教训：曾经手绘过一套 SDF 标记（「木墨」时期），结论是远不如设计稿有辨识度，
> 已全部废弃。**不要再手绘品牌图形**，派生即可。

改了 `lib/theme.ts` 的 palette 后要同步 `BRAND` 并重跑 `generate:icons`。

新增原生依赖**必须** `npx expo install`（走官方矩阵），手写版本号会被
`check:deps` 拦下。

## 环境

- Expo SDK 56，React Native 0.85，TypeScript 6.0 严格模式
- **部署目标：手机 App（Android 为主，iOS 可构建）；不支持、不维护 Web 端**
- 数据存储基于 JSON 文件（expo-file-system），无数据库依赖
- expo-router 文件路由
- 动效：`react-native-reanimated` 4 + `react-native-worklets`
  （**GSAP 不可用** —— 它依赖 DOM，在 React Native 里跑不起来）
- 图标与纹理：`react-native-svg`；触感：`expo-haptics`

### babel.config.js 是必需的，不是可选的

`babel-preset-expo` **不会**自动注入 `react-native-worklets/plugin`（实测全量搜索 0 命中）。
Reanimated 4 的 worklet 依赖该插件把函数改写成可序列化闭包；插件缺失时
**不会有编译期报错**，而是运行时才抛
`Tried to synchronously call a non-worklet function` ——
release 包里没有红屏浮层，表现就是**启动即崩**。

`npm run check:babel` 会真实跑一遍 babel 并断言产物含 `__workletHash`。
改动 babel 配置后务必重跑。

## 编码约定

- 组件文件：PascalCase（`ItemCard.tsx`）
- 服务/仓储：camelCase（`itemRepository.ts`）
- 路由页面：按 expo-router 文件路由约定（`[id].tsx`, `_layout.tsx`）
- 数据类型统一定义在 `lib/types.ts`
- 组件放在 `components/`，页面逻辑留在 `app/` 中
- 存储/服务/仓储放在 `lib/` 对应子目录
- 设计令牌与图标路径放在 `lib/`（`theme.ts` / `icons.ts`），见「视觉体系」一节
- 数据访问通过 `lib/repositories/` 层，页面不直接操作 `lib/storage/`
- 所有字段属性名使用 camelCase
- **不要在组件里硬编码色值**，一律取 `lib/theme.ts` 的语义令牌（`colors.*`）
- **不要在业务代码里直接写 `Ionicons name="..."`**，走 `components/Icon.tsx` 的语义名
- **不要给界面加纹理 / 贴图**，见「视觉体系」一节的历史教训
- 不要添加 Web 平台配置或依赖（如 `react-dom`、`react-native-web`）

## 运行命令

```bash
cd apps/mobile
npm install                 # 安装依赖
npm run check               # 类型检查 + 单元测试
npx expo start              # 启动开发服务器（扫码用真机/模拟器）
npx expo start --android    # 直接运行 Android
npx expo start --ios        # 直接运行 iOS（需 macOS）
```

## 构建与签名（重要）

- 发版构建走 CNB 流水线（仓库根 [.cnb.yml](../../.cnb.yml)）；GitHub Actions 是备份，两者用同一把正式签名密钥。
- `android/` 是 `expo prebuild` 的产物且被 gitignore，**不要手改**——它会被 `--clean` 覆盖。
  需要改原生配置时，写成 `expo prebuild` 之后运行的脚本，例如
  [scripts/apply-release-signing.js](scripts/apply-release-signing.js)（注入正式签名）。
- 签名密钥绝不入库：本地 `/.secrets`（根目录已 gitignore），CI 侧走密钥仓库 / GitHub Secrets 注入。
- 不要给 release 构建加「失败就退回 debug」的兜底：签名不同的包无法覆盖安装。
- 发版时把 `app.json` 的 `expo.version` 与 `expo.android.versionCode` 一起递增；`versionCode` 只增不减，
  否则用户装不上新版。
- **版本号有两套，别混**（详见 [docs/SPEC.md 7.2](../../docs/SPEC.md)）：
  - **App 版本** = `app.json` 的 `expo.version` / `expo.android.versionCode`，给用户和构建用；
  - **功能版本** = [CHANGELOG.md](CHANGELOG.md) 顶部版本头，功能里程碑用。
  - 两者是不同命名空间，**不要求同号**。发版时把 `Unreleased` 改写成对应的功能版本号与日期。
