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

## 环境

- Expo SDK 56，React Native 0.85，TypeScript 6.0 严格模式
- **部署目标：手机 App（Android 为主，iOS 可构建）；不支持、不维护 Web 端**
- 数据存储基于 JSON 文件（expo-file-system），无数据库依赖
- expo-router 文件路由

## 编码约定

- 组件文件：PascalCase（`ItemCard.tsx`）
- 服务/仓储：camelCase（`itemRepository.ts`）
- 路由页面：按 expo-router 文件路由约定（`[id].tsx`, `_layout.tsx`）
- 数据类型统一定义在 `lib/types.ts`
- 组件放在 `components/`，页面逻辑留在 `app/` 中
- 存储/服务/仓储放在 `lib/` 对应子目录
- 数据访问通过 `lib/repositories/` 层，页面不直接操作 `lib/storage/`
- 所有字段属性名使用 camelCase
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
