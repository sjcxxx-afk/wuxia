# Changelog

## Unreleased

### Fixed
- 修复同步导入清空缓存后无法写回，以及同步设置重启后未及时恢复的问题
- 同步合并支持删除标记，避免已删除的匣物或分类被其他设备重新带回
- 删除分类时清空关联匣物的分类关系

### Changed
- 数据文件升级为兼容的 v2 格式，增加原子写入和最近 3 份本地备份恢复
- API Key 改用系统安全存储，AI 功能在首次发送数据前请求明确授权
- 新增类型检查、Jest 单元测试与 Gitee Go 质量检查工作流

## v3.0.0 (2026-05-29)

### Added
- 匣物图片管理：支持为匣物添加多张图片，列表缩略图显示，详情页图片画廊
- 分类自定义字段：支持 text/number/date 类型，入匣时动态渲染

### Changed
- 拆分 Profile 页面为独立组件
- 提取同步设置为独立模块
- 完善项目文档（README、CHANGELOG、AGENTS.md）
- 品牌文案对齐：物匣 / 匣中 / 匣灵 / 匣主（入匣 · 改匣）

### Fixed
- 修复 ItemCard 中 snake_case 属性名拼写错误
- 修复编辑页面表单初始值 key 不匹配问题

## v2.0.0 (2026-05-21)

### Changed
- **去登录化**：移除 Supabase Auth，打开即用
- **JSON 本地存储**：替换 PostgreSQL + expo-sqlite
- **云盘同步**：手动导出/导入 JSON 实现多设备数据流转
- 新增 OCR 截图识别（AI 视觉模型提取订单信息）
- 新增 CSV/Excel 批量导入
- 新增等级系统

### Removed
- `@supabase/supabase-js`、`expo-sqlite`、`expo-secure-store` 依赖

## v1.0.0 (2026-05-16)

### Added
- 初始版本：基于 Supabase Auth + PostgreSQL 的物匣（个人物匣）
- 匣物 CRUD、分类管理、寻觅筛选
