# Changelog

## Unreleased

### Added
- **木墨视觉体系**：以「匣就是木头做的」为立意，引入宣纸 / 木 / 墨 / 朱砂四组材质。新增 `lib/theme.ts` 作为设计令牌唯一来源（色板、间距、圆角、阴影、字号、动效、纹理上限），替换此前散落 33 个文件的硬编码色值
- 木墨图标体系：新增 `lib/icons.ts`（24×24 圆头描边路径库）与 `components/Icon.tsx`，重绘导航四图标（匣中=木匣 / 分类=博古架 / 搜索 / 匣主=钤印）
- 匣主等级图标由 emoji（📦🔰📚🎯👑🌟）改为「一只木匣逐渐被填满、最后满匣生光」的线性图标
- 矢量纹理组件 `WoodGrain`（木纹）与 `PaperSurface` / `PaperGrain`（宣纸底 + 墨晕）
- 资源生成管线：`scripts/generate-textures.js`（零依赖手写 PNG 编码器 + 格点周期化值噪声 fBm，产出可无缝平铺纹理）与 `scripts/icons.js`（有向距离场 SDF 解析抗锯齿绘制品牌标记）
- 新增三道质量守卫并接入 `npm run check`：`check:theme`（实测所有前景/背景组合的 WCAG 对比度）、`check:textures`（校验磁盘产物与生成器漂移）、`check:babel`（断言 worklet 已被正确改写）
- 新增原生依赖：`react-native-svg` 15.15.4、`expo-haptics` ~56.0.3、`expo-image` ~56.0.13

### Fixed
- 修复启动页「方块套方块」：`assets/` 下四张图字节完全相同，`splash-icon.png` 实为带圆角与渐变的满幅应用图标，被压在 `#4F46E5` 底色上形成双重方形违和感。`app.json` 移除 splash 图改纯宣纸底，从根上消除该现象
- 修复底部导航栏的交互缺失：原先仅颜色变化，无按下态、无图标动画、四个 Tab 之间为硬切。改为矢量木纹木架 + 滑动朱砂标记 + 按压 spring 回弹 + 图标着墨动画 + 字重变化 + `shift` 转场 + `freezeOnBlur` + 轻触感
- 修复匣灵头像错用应用图标（占位符残留导致 `assets/xialing-avatar.png` 与应用图标字节相同），改为程序生成的朱砂印标记
- 修复 Android 13+ 主题图标缺失，新增 `adaptive-icon-monochrome.png`（纯黑前景，由系统着色）
- **补上 `babel.config.js`**：`babel-preset-expo` 不会自动注入 `react-native-worklets/plugin`（实测全量搜索 0 命中）。Reanimated 4 缺该插件时**没有编译期报错**，而是运行时抛 `Tried to synchronarily call a non-worklet function`，release 包无红屏浮层，表现即启动闪退

### Changed
- 视觉主色由靛蓝 `#4F46E5` 改为朱砂 `#B03A2E`。冷调紫与暖木纹相乘必然发脏；朱砂是水墨中唯一的高彩度色，用量刻意压到极小，仅用于选中态、主操作与角标
- 纹理强度硬性钳制：木纹 ≤10%、纸纹 ≤6%，48px 以下控件内部禁止放纹理（否则糊成噪点）。这是「木墨」不滑向茶室风的关键约束
- 图表分类色板收敛为 4 档（`theme.chart`），替换此前 7 个 Tailwind 色随手排列、相邻档难以分辨的写法；四档实测均 ≥4.5:1
- 资源不再手绘 PNG：图标与纹理全部由脚本生成，可复算、可回归，避免二进制漂移
- `EmptyState` 的 `icon` 属性类型由 `keyof typeof Ionicons.glyphMap` 收紧为 `IconName`，不再向调用方暴露底层库的 glyph 名
- 底部导航栏改用 expo-router 自带的 `BottomTabBarProps`（type-only 深路径导入，`@react-navigation/bottom-tabs` 并非直接依赖）
- `AGENTS.md` 补充「视觉体系」一节，记录材质分工、两条纹理铁律与反例

### Removed
- 移除 `assets/splash-icon.png`：满幅图标不该充当启动图，改由 `InkSplash.tsx` 在应用内接管过渡


### Added
- 新增 CNB（cnb.cool）云原生构建流水线：`.cnb.yml` + 工具链镜像 `.cnb/Dockerfile.android`（JDK 17 / Node 22 / SDK 36 / NDK 27.1），并支持页面手动触发构建
- 新增 Android 正式签名：release keystore 生成并接入 CI 密钥注入，`scripts/apply-release-signing.js` 在 prebuild 后替换模板默认的 debug 签名，配套单元测试
- 显式声明 `android.versionCode`（原先依赖隐式默认值 1），并在构建日志中打印本次版本号

### Fixed
- 修复 release 包「装完点开即闪退」：`react` 被 pin 成 19.2.8，而 RN 0.85.3 自带的 renderer 在模块加载时硬性断言 `react` 必须恰好是 19.2.3，首帧挂载原生事件时惰性加载该 renderer 即抛 `Incompatible React versions`（debug 下是红屏，release 下直接退出）。`react` / `react-dom` 回到 19.2.3
- 修复依赖漂离 Expo SDK 56 官方矩阵：`expo-secure-store` 57.0.2 → 56.0.4；`react-native-screens` 4.25.2（低于 expo-router 要求的 ^4.26.0，导致 node_modules 里同时存在 4.25.2 与嵌套 4.27.0，原生只编进 4.25.2 而 JS 打进 4.27.0）→ ~4.26.0，并 `npm dedupe` 消掉重复；`react-native-gesture-handler` 经 `overrides` 固定到 ~2.31.1（原先被 peer 范围拉到 3.2.1 跨大版本）
- 新增依赖矩阵守卫 [scripts/check-dependency-matrix.js](scripts/check-dependency-matrix.js)：在 `npm run check` 与两条发版流水线的 `npm ci` 之后拦截 react 版本不一致、expo 包跨 SDK 大版本、原生模块被装成两份这三类漂移，避免再产出「装完即闪退」的包
- 修复同步导入清空缓存后无法写回，以及同步设置重启后未及时恢复的问题
- 同步合并支持删除标记，避免已删除的匣物或分类被其他设备重新带回
- 删除分类时清空关联匣物的分类关系

### Changed
- 依赖补齐到 Expo SDK 56 官方矩阵的最新补丁：`expo` 56.0.20→56.0.23、`expo-modules-core` 56.0.24→56.0.27、`expo-router` 56.2.19→56.2.21、`expo-constants` 56.0.24→56.0.27、`expo-dev-client` 56.0.25→56.0.27、`expo-image-picker` 56.0.24→56.0.25、`expo-linking` 56.0.17→56.0.18、`expo-splash-screen` 56.0.14→56.0.15、`expo-file-system` 56.0.10→56.0.11（均为 56.x 内部补丁，不跨 SDK 小版本）；`expo install --check` 现已全绿
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
