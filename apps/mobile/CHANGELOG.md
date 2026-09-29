# Changelog

## Unreleased

### Added
- 新增 CNB（cnb.cool）云原生构建流水线：`.cnb.yml` + 工具链镜像 `.cnb/Dockerfile.android`（JDK 17 / Node 22 / SDK 36 / NDK 27.1），并支持页面手动触发构建
- 新增 Android 正式签名：release keystore 生成并接入 CI 密钥注入，`scripts/apply-release-signing.js` 在 prebuild 后替换模板默认的 debug 签名，配套单元测试
- 显式声明 `android.versionCode`（原先依赖隐式默认值 1），并在构建日志中打印本次版本号

### Fixed
- 修复同步导入清空缓存后无法写回，以及同步设置重启后未及时恢复的问题
- 同步合并支持删除标记，避免已删除的匣物或分类被其他设备重新带回
- 删除分类时清空关联匣物的分类关系

### Changed
- 数据文件升级为兼容的 v2 格式，增加原子写入和最近 3 份本地备份恢复
- API Key 改用系统安全存储，AI 功能在首次发送数据前请求明确授权
- 新增类型检查与 Jest 单元测试（CI 质量检查与出包统一改由 CNB / GitHub Actions 承担）
- GitHub Actions 备份流水线改用同一把正式签名，并移除 release 失败就退回 debug 的兜底（签名不同的包无法覆盖安装）

### Removed
- 移除 expo-updates OTA 热更新：删除 useAppUpdates Hook 与 UpdateBanner 横幅，清理 app.json 的 updates/runtimeVersion 与 eas.json 的 channel 配置；更新方式统一为重新构建安装包
- 彻底清理 EAS 残留：删除 eas.json、.easignore、eas-cli 依赖（连带移除 319 个包）以及 app.json 中的 eas.projectId / owner
- 弃用 Gitee：移除 Gitee 远端与 Gitee Go 流水线配置；代码托管收敛为 GitHub + CNB

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
