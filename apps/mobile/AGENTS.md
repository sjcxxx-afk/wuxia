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

## 环境

- Expo SDK 56，React Native 0.85，TypeScript 严格模式
- **部署目标：手机 App（Android / iOS）；不支持 Web，勿添加 Web 依赖或 `expo start --web` 相关配置**
- 数据存储基于 JSON 文件（expo-file-system），无数据库依赖

## 编码约定

- 文件命名：组件 PascalCase（`ItemCard.tsx`），服务/仓储 camelCase（`itemRepository.ts`）
- 路由采用 expo-router 文件路由，页面放在 `app/` 下
- 数据类型统一定义在 `lib/types.ts`
- 组件放在 `components/`，页面级逻辑留在 `app/` 中
- 存储/服务/仓储放在 `lib/` 对应子目录
- 所有字段属性名使用 camelCase
