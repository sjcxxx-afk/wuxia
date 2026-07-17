# 物匣 — AI Agent 规则

## 品牌用语

用户可见文案统一：**物匣** / **匣中** / **匣物** / **匣主** / **匣灵** / **入匣·改匣**。代码路由与类型名仍用 `items` / `Item` / `profile`。

## 项目结构

```
物匣/
├── apps/mobile/          ← Expo 应用入口
│   ├── app/              ← expo-router 页面（文件路由）
│   ├── components/       ← 可复用 UI 组件
│   ├── lib/              ← 业务逻辑（types, storage, repositories, ocr, ai, updates）
│   ├── assets/           ← 静态资源（图标、启动图）
│   ├── package.json      ← Expo 项目入口（在此目录执行 npx expo start）
│   ├── app.json          ← Expo 配置
│   ├── tsconfig.json     ← TypeScript 配置
│   └── eas.json          ← EAS Build 配置
├── docs/                 ← 项目文档
│   ├── PRD.md            ← 产品需求文档
│   └── SPEC.md           ← 技术规范文档
├── .claude/              ← AI Agent 上下文
└── README.md             ← 项目整体说明
```

## 环境

- Expo SDK 56，React Native 0.85，TypeScript 6.0
- **部署目标：手机 App（Android 为主，iOS 可构建）；不支持、不维护 Web 端**
- 数据存储基于 JSON 文件（expo-file-system），无数据库依赖
- expo-router 文件路由

## 编码约定

- 组件文件：PascalCase（`ItemCard.tsx`）
- 服务/仓储：camelCase（`itemRepository.ts`）
- 路由页面：按 expo-router 文件路由约定（`[id].tsx`, `_layout.tsx`）
- 数据类型统一定义在 `lib/types.ts`
- 组件放在 `components/`，页面逻辑留在 `app/` 中
- 数据访问通过 `lib/repositories/` 层，页面不直接操作 `lib/storage/`
- 所有字段属性名使用 camelCase
- 不要添加 Web 平台配置或依赖（如 `react-dom`、`react-native-web`）

## 运行命令

```bash
cd apps/mobile
npm install                 # 安装依赖
npx expo start              # 启动开发服务器（扫码用真机/模拟器）
npx expo start --android    # 直接运行 Android
npx expo start --ios        # 直接运行 iOS（需 macOS）
npx eas build -p android --profile preview  # 构建 Android APK
```
