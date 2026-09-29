# 物匣

> 手机 App 个人物匣 — 记录、整理和寻觅匣中之物。

品牌用语：**物匣** / **匣中** / **匣灵** / **匣主**（入匣 · 改匣）。

**部署形态**：原生手机 App（Android 为主，iOS 可构建），由 CNB 云原生构建产出正式签名 APK 安装到设备。**不支持 Web / 浏览器端。**

## 项目结构

```
├── .cnb.yml          ← CNB 流水线（发版构建主路径）
├── .cnb/             ← CNB 工具链镜像 Dockerfile 与手动触发按钮
├── .github/          ← GitHub Actions 备份流水线
├── apps/mobile/      ← 手机 App（Expo + React Native）
├── docs/             ← 项目文档
│   ├── PRD.md        ← 产品需求文档
│   └── SPEC.md       ← 技术规范文档
└── README.md         ← 项目整体说明
```

## 远程仓库与发版

| 远端 | 地址 | 用途 |
|------|------|------|
| `origin` | [github.com/sjcxxx-afk/wuxia](https://github.com/sjcxxx-afk/wuxia) | 代码备份 + GitHub Actions 备份构建 |
| `cnb` | [cnb.cool/qi_si_miao_xiang/wuxia](https://cnb.cool/qi_si_miao_xiang/wuxia) | 主构建平台（CNB 流水线） |

Gitee 已弃用：原来的 `origin` 远端、Gitee Go 流水线配置与对应分支均已移除。

> CNB 侧的签名密钥存放在**密钥仓库** `qi_si_miao_xiang/wuxia-build-secret`——该类型不可 clone、
> 只能在网页编辑，由 [.cnb.yml](.cnb.yml) 的 `imports:` 引用后注入为环境变量。keystore 原件与密码另在
> 本地 `.secrets/` 备份（已 gitignore）。

推送到 CNB：

```bash
git push cnb master
```

CNB **不支持 SSH**，只走 HTTPS + 访问令牌：提示输入凭据时**用户名固定填 `cnb`**，密码填访问令牌
（在 CNB「个人设置 → 访问令牌」创建，可限定只读/读写、可随时撤销）。

不想每次推两遍的话，可以用 CNB 的 Git Sync 插件（`tencentcom/git-sync`）在 CNB ↔ GitHub 之间自动同步；
配置写进 `.cnb.yml`，另需一个 GitHub Personal Access Token 存到 CNB 密钥仓库。

## 快速开始

```bash
cd apps/mobile
npm install
npx expo start                 # 真机扫码或模拟器调试
npx expo start --android       # 直接跑 Android
```

发版构建走 CNB 流水线（见 [apps/mobile/README.md](apps/mobile/README.md) 的「构建与发版」）；也可本地出包：

```bash
cd apps/mobile
npx expo prebuild --platform android --clean
node scripts/apply-release-signing.js        # 仅在 WUXIA_* 环境变量齐全时注入正式签名
cd android && ./gradlew assembleRelease
```

## 技术栈

- React Native 0.85 + Expo SDK 56（手机 App）
- expo-router（文件路由） + TypeScript
- JSON 文件存储（expo-file-system，原子写入 + 本地备份）
- CNB 云原生构建（主）/ GitHub Actions（备份）产出正式签名 APK，覆盖安装更新

## 文档

- [产品需求文档](docs/PRD.md)
- [技术规范文档](docs/SPEC.md)
