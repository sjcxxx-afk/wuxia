# 物匣

> 手机 App 个人物匣 — 记录、整理和寻觅匣中之物。

品牌用语：**物匣** / **匣中** / **匣灵** / **匣主**（入匣 · 改匣）。

**部署形态**：原生手机 App（Android 为主，iOS 可构建），经 EAS Build 安装到设备。**不支持 Web / 浏览器端。**

## 项目结构

```
├── apps/mobile/      ← 手机 App（Expo + React Native）
├── docs/             ← 项目文档
│   ├── PRD.md        ← 产品需求文档
│   └── SPEC.md       ← 技术规范文档
└── .claude/          ← AI Agent 上下文
```

## 快速开始

```bash
cd apps/mobile
npm install
npx expo start                 # 真机扫码或模拟器调试
npx expo start --android       # 直接跑 Android
npx eas build -p android --profile preview  # 构建手机 APK
```

## 技术栈

- React Native 0.85 + Expo SDK 56（手机 App）
- expo-router（文件路由） + TypeScript
- JSON 文件存储（expo-file-system，原子写入 + 本地备份）
- EAS Build + expo-updates（安装包分发与 OTA）

## 文档

- [产品需求文档](docs/PRD.md)
- [技术规范文档](docs/SPEC.md)
