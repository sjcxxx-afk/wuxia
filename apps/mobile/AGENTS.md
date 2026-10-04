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

## 视觉体系：木墨（务必先读）

产品叫「物匣」，匣就是木头做的；中式绘画里专讲器物收藏的「博古图」正是水墨。
所以**木纹不是装饰，是产品本体的隐喻**。视觉以「宣纸 + 木 + 墨 + 朱砂」四组材质构成。

### 两条铁律（违反即视为 bug）

1. **纹理克制**：木纹不透明度 ≤ 10%，纸纹 ≤ 6%。由 `theme.texture` 硬钳，
   `WoodGrain` / `PaperGrain` 组件内部会强制 clamp。
   48px 以下的小控件（chip / badge / 小按钮）内部**禁止**放纹理，会糊成噪点。
2. **对比度**：正文必须过 WCAG AA。`npm run check:theme` 会实测所有前景/背景组合，
   不要靠目测。改动 `lib/theme.ts` 的 palette 后必须重跑。

### 材质分工

| 承载 | 用什么 | 落在哪 |
|------|--------|--------|
| 匣（容器结构） | 木纹 | 底部导航栏、顶栏 |
| 纸（内容承载） | 宣纸色 + 极淡墨晕 | 页面底（`PaperSurface`） |
| 墨（内容） | 焦墨→淡墨→清墨三级 | 所有文字 |
| 印（强调） | 朱砂 | 选中态、主操作、角标 |

**朱砂是全局唯一高彩度色**，用量必须极小。木面上必须用 `colors.accentOnWood`
（深朱砂）而不是 `colors.accent` —— 普通朱砂在浅木底上只有 3.5:1，不达标。

### 关键文件

| 文件 | 职责 |
|------|------|
| `lib/theme.ts` | 设计令牌唯一来源。色板 / 间距 / 圆角 / 阴影 / 字号 / 动效 / 纹理上限 |
| `lib/icons.ts` | 木墨图标路径库（24×24 圆头描边）。新增图标在这里加，不要直接写 SVG |
| `components/Icon.tsx` | 图标组件。**不要**在业务代码里直接用 `Ionicons` |
| `components/Texture/WoodGrain.tsx` | 矢量木纹（不用位图：木纹有方向，拉伸必失真） |
| `components/Texture/PaperSurface.tsx` | 页面根容器（宣纸底 + 矢量墨晕） |
| `components/Texture/PaperGrain.tsx` | 纸纹平铺（位图）。**fine 与 fiber 不可叠加**，会破 6% 铁律 |
| `components/InkSplash.tsx` | 水墨启动页 |
| `components/WoodTabBar.tsx` | 底部导航栏 |

### 资源与脚本

纹理与图标都是**脚本生成**的，不要手改 PNG，也不要凭肉眼判断接缝：

```bash
npm run generate:textures   # 重新生成 assets/textures/*.png
npm run generate:icons      # 重新生成图标与匣灵头像
npm run check:textures      # 校验磁盘产物与生成器是否漂移
```

- `scripts/generate-textures.js` —— 零依赖，手写 PNG 编码器 + 可平铺值噪声 fBm。
  用**格点周期化**实现无缝平铺。
- `scripts/icons.js` —— 用**有向距离场（SDF）解析抗锯齿**绘制木匣标记与朱砂印。
  不用 AI 重绘：确定性、可复算、可回归。

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
- **不要在业务代码里直接用 `Ionicons`**，品牌与功能图标走 `components/Icon.tsx`；
  通用图标（关闭 / 箭头 / 删除 / 相机）保留 Ionicons 不算违规
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
