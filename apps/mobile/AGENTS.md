# AGENTS.md — 个人仓库管理系统

## 环境

- Expo SDK 55，参考文档 https://docs.expo.dev/versions/v55.0.0/
- React Native 0.83，TypeScript 严格模式
- 数据存储基于 JSON 文件（expo-file-system），无数据库依赖

## 编码约定

- 文件命名：组件 PascalCase（`ItemCard.tsx`），服务/仓储 camelCase（`itemRepository.ts`）
- 路由采用 expo-router 文件路由，页面放在 `app/` 下
- 数据类型统一定义在 `src/types.ts`
- 组件放在 `components/`，页面级逻辑留在 `app/` 中
- 存储/服务/仓储放在 `src/` 对应子目录
- 所有字段属性名使用 camelCase
