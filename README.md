# 个人仓库管理系统

> 跨平台个人物品管理工具 — 记录、整理和查询你的物品。

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
