# 物匣

> 跨平台个人物匣 — 记录、整理和寻觅匣中之物。

品牌用语：**物匣** / **匣中** / **匣灵** / **匣主**（入匣 · 改匣）。

## 项目结构

```
├── apps/mobile/      ← 移动端应用 (Expo + React Native)
├── docs/             ← 项目文档
│   ├── PRD.md        ← 产品需求文档
│   └── SPEC.md       ← 技术规范文档
└── .claude/          ← AI Agent 上下文
```

## 快速开始

```bash
cd apps/mobile
npm install
npx expo start
```

## 技术栈

- React Native 0.85 + Expo SDK 56
- expo-router（文件路由） + TypeScript
- JSON 文件存储（expo-file-system）

## 文档

- [产品需求文档](docs/PRD.md)
- [技术规范文档](docs/SPEC.md)
