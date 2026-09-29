# 物匣

> 手机 App 个人物匣，帮助匣主记录、整理和寻觅匣中之物。

## 项目简介

线上购物频率越来越高，囤积之后容易忘记匣中已有、重复购买、找不到东西。物匣提供一个简洁实用的个人收藏管理方案。

**核心理念**：打开即用、无需登录、数据本地存储、匣主完全掌控。

**品牌用语**：物匣（产品）· 匣中（列表）· 匣物（单件）· 匣主（设置/资料）· 匣灵（AI）· 入匣 / 改匣（增改）。

**部署形态**：原生手机 App（Android 为主，iOS 可构建）；经 CNB 流水线构建正式签名安装包并安装到手机。**不支持、不维护 Web 端。**

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React Native 0.85 + Expo SDK 56 |
| 导航 | expo-router（文件路由） |
| 数据存储 | JSON 文件（expo-file-system） |
| 开发语言 | TypeScript |
| 部署目标 | 手机 App：Android / iOS（非 Web） |
| 分发 | CNB（主）/ GitHub Actions（备份）构建正式签名 APK，覆盖安装更新 |

## 快速开始

```bash
cd apps/mobile
npm install
npx expo start                 # 真机扫码或模拟器
npx expo start --android       # 直接跑 Android
npm run check                  # 类型检查 + 单元测试
```

## 目录结构

```
apps/mobile/
├── app/                    # 路由页面（expo-router 文件路由）
│   ├── _layout.tsx         # 根布局
│   └── (tabs)/             # 底部 Tab：匣中 / 分类 / 搜索 / 匣主
│       ├── items/          # 匣中（列表、入匣、详情、改匣）
│       ├── categories/     # 分类管理
│       ├── search/         # 寻觅筛选 + 匣灵
│       └── profile/        # 匣主（概览、同步、AI 配置）
├── components/             # 可复用 UI 组件
├── lib/
│   ├── types.ts            # 类型定义
│   ├── storage/            # 数据存储层（JSON 读写、同步、图片）
│   ├── repositories/       # 数据仓储层（匣物、分类、匣主资料）
│   └── ocr/                # OCR 识别与文件导入服务
└── database/               # 数据库参考 DDL（仅文档）
```

## 功能特性

- **匣中打理**：入匣、改匣、移出物匣，支持名称、品牌、价格、购买平台、存放位置等字段
- **分类管理**：自定义分类（emoji 图标 + 颜色标识）
- **寻觅筛选**：关键词寻觅 + 分类/状态筛选
- **图片管理**：为匣物添加多张图片
- **自定义字段**：不同分类可配置额外字段（文本/数字/日期）
- **数据入匣**：支持订单截图 AI 识别、CSV/Excel 批量入匣
- **匣灵问答**：自然语言查询物匣数据
- **数据同步**：手动导出/导入同步文件（`.txt`，内容为 JSON），支持云盘文件夹多设备同步
- **数据保护**：原子写入与最近 3 份本地备份；同步以记录更新时间和删除标记合并
- **AI 隐私**：API Key 使用系统安全存储；首次使用 OCR、问答或评价前明确说明并征得授权
- **匣主等级**：6 级成长体系（初启匣主 → 万物匣主），激励持续使用

## 构建与发版

**构建平台**：CNB（cnb.cool 云原生构建）为主，GitHub Actions 为备份，两者产出**同一把正式签名**的 APK。
**更新方式**：不发 OTA。改了代码 → 重新构建 → 把 APK 分发给用户 → 覆盖安装（本地数据保留）。

### CNB 首次接入（四步）

0. **把代码推到 CNB**：`git push cnb master`（远端已配置为 `cnb.cool/qi_si_miao_xiang/wuxia`；
   认证走 HTTPS + 访问令牌、不支持 SSH，详见仓库根 [README.md](../../README.md) 的「远程仓库与发版」）。
1. **建密钥仓库**：CNB → 新建仓库 → 类型选「密钥仓库」。该类型禁止 clone 到本地、禁止本地推送，
   只能在网页上编辑——这是特意的限制，把本地 `.secrets/cnb-secret-repo.yml` 的内容整份粘贴进去即可，
   文件名记为 `wuxia-build.yml`。
2. **接通流水线**：编辑仓库根目录 [.cnb.yml](../../.cnb.yml)，把 `imports:` 的地址换成该密钥仓库文件的真实地址
   （形如 `https://cnb.cool/<组织>/<密钥仓库>/-/blob/main/wuxia-build.yml`）。
3. **跑一次**：在「代码 → 分支详情页 → 构建 Android APK」手动触发；构建产物在该次构建的「制品」里下载。

触发规则：master 分支 push，且改动命中 `apps/mobile/**`、`.cnb.yml` 或 `.cnb/**` 时自动构建。
工具链镜像由 [.cnb/Dockerfile.android](../../.cnb/Dockerfile.android) 定义，经 `docker:cache` 构建后跨节点复用，
只有该 Dockerfile 变化时才重建。

### GitHub 备份流水线（可选）

[build-android.yml](../../.github/workflows/build-android.yml) 仍可使用，但需在
仓库 Settings → Secrets and variables → Actions 里补 4 个 Secret（内容与 CNB 密钥仓库相同）：

`WUXIA_KEYSTORE_BASE64`、`WUXIA_KEYSTORE_PASSWORD`、`WUXIA_KEY_ALIAS`、`WUXIA_KEY_PASSWORD`

CNB 跑通之后，可以直接删掉这个工作流。

### 正式签名

- keystore 放在本地 `.secrets/`（已 gitignore），CNB 侧放在密钥仓库；构建时注入为环境变量，构建结束立即删除。
- [scripts/apply-release-signing.js](scripts/apply-release-signing.js) 在 `expo prebuild` 之后把 release buildType
  从模板自带的 debug 签名改成 `signingConfigs.release`。CI 用 `--require` 调用：**缺少密钥就直接失败**。
- 已刻意**移除 debug 兜底**：兜底会产出签名不同的 APK，用户覆盖安装必然失败，比构建失败更糟。
- ⚠️ **签名从调试密钥换成正式密钥后，已装设备必须先卸载再装新版**（Android 不允许签名变更的覆盖安装）。
  卸载会清空应用私有目录，请先在「匣主 → 同步」导出一次数据，重装后再导入。
- 当前正式签名指纹：`SHA1 44:8B:9C:0E:4D:2C:82:55:F1:58:E3:55:97:E6:F2:1E:E9:C0:47:D2`

### 版本号

发版时同时递增 [app.json](app.json) 里的两个字段，缺一不可：

- `expo.version`：语义化版本，给人看的（如 `1.0.1`）；
- `expo.android.versionCode`：整数，供 Android 判断能否覆盖安装，**必须只增不减**。

建议：修 bug 时 `version` 末位 +1，加功能时中位 +1，而 `versionCode` 每次发版都 +1。
构建日志会打印本次的版本，便于事后核对。

### 工具链拉取失败怎么办

[.cnb/Dockerfile.android](../../.cnb/Dockerfile.android) 会从 `dl.google.com`（cmdline-tools / SDK / NDK）与
`deb.nodesource.com`（Node 22）拉取工具链。国内构建节点若超时：

1. 先重试一次——镜像构建成功后跨节点缓存，后续构建不再重复拉取；
2. 仍失败则把 `.cnb.yml` 里 `docker.image` 换成已内置 Android SDK 的公共镜像，并在流水线里补装 Node
   与缺失的 SDK 组件；
3. gradle 依赖走 `google()` / `mavenCentral()`，若明显缓慢，可在 `expo prebuild` 之后把
   `android/build.gradle` 的仓库替换为阿里云镜像（`maven.aliyun.com/repository/google`、`/public`、`/gradle-plugin`）。

## 多设备同步

1. 在一台设备上使用 App 打理物匣
2. 进入「匣主」→ 设置同步文件夹路径 → 点击「导出数据」
3. 同步文件夹中会生成 `warehouse-data.txt`（内容仍是 JSON，便于夸克等网盘同步）
4. 在另一台设备上进入「匣主」→ 点击「导入数据」合并云端更新
5. 数据自动按时间戳合并

同步文件不包含 API Key 或应用私有备份。删除操作也会通过删除标记同步到其他设备；同一条记录冲突时自动保留更新时间较新的版本。

## 版本历史

详见 [CHANGELOG.md](./CHANGELOG.md)
