# 物匣 — 技术规范文档 (SPEC v4.1)

> 版本：v4.1.0 | 更新：2026-10-08 | 基于 PRD v3.0 编写
>
> 本文档自身的版本号跟随[功能版本](#72-版本号规则)（与 CHANGELOG 同步），不跟随 `app.json` 的 App 版本。
>
> 品牌用语（与 PRD / UI 对齐）：**物匣**（产品）/ **匣中**（列表）/ **匣物**（单件）/ **匣主**（使用者）/ **匣灵**（AI）/ **入匣·改匣**（增改操作）。代码路由与类型名仍用 `items` / `Item` / `profile`。

---

## 目录

1. [技术选型](#一技术选型)
2. [数据模型](#二数据模型)
3. [API 接口设计](#三api-接口设计)
4. [项目目录结构](#四项目目录结构)
5. [外部服务集成](#五外部服务集成)
6. [安全与权限](#六安全与权限)
7. [构建与部署](#七构建与部署)

---

## 一、技术选型

### 1.1 总体架构

> **部署范围**：手机 App（Android 为主，iOS 可构建）。通过 CNB 云原生构建（GitHub Actions 备份）产出正式签名安装包分发，版本更新即重新构建并覆盖安装。**不支持、不规划 Web / 浏览器端。**

```
┌──────────────────────────────────────────┐
│   Mobile App (Android / iOS)              │
│              Presentation Layer           │
│   React Native 0.85 + Expo SDK 56         │
│   expo-router (file-based navigation)     │
├──────────────────────────────────────────┤
│              Application Layer            │
│   Repository Pattern (数据仓储层)          │
│   Service Layer (AI / OCR / Backup)       │
├──────────────────────────────────────────┤
│              Infrastructure Layer         │
│   expo-file-system (JSON + Image I/O)     │
│   expo-image-picker / image-manipulator   │
│   expo-document-picker                    │
└──────────────────────────────────────────┘
```

### 1.2 技术栈明细与选型理由

| 类别 | 技术 | 版本 | 选型理由 |
|------|------|------|----------|
| **框架** | React Native | 0.85.3 | 手机 App 首选，单套代码覆盖 Android / iOS；活跃社区 + Meta 官方维护。本项目仅部署手机端，不包含 Web |
| **工具链** | Expo SDK | 56 | 免原生配置的开发体验；插件生态丰富；prebuild 出原生工程后可放到任意 CI 构建 |
| **路由** | expo-router | 56.2 | 文件系统路由（类 Next.js），约定优于配置；支持 Stack/Tabs 嵌套、动态路由、深层链接 |
| **语言** | TypeScript | 6.0 | 静态类型检查，减少运行时错误；完善的 IDE 智能提示 |
| **存储** | expo-file-system | 56.0 | 单 JSON 文件方案：零数据库依赖、数据透明可读、导出即为人类可读文本；适合个人工具的小数据量场景 |
| **图片** | expo-image-picker | 56.0 | 系统级相册选择，支持多选 + 质量压缩；与 expo-file-system 协同存储 |
| **图片压缩** | expo-image-manipulator | 56.0 | 入匣时把相册原图缩到最长边 1600 再落盘，避免单图数 MB 堆积成备份包体积黑洞 |
| **备份包读写** | expo-file-system（新 API） | 56.0 | `Directory.pickDirectoryAsync()` 跨平台选择文件夹，`File.copy()` 直接搬运二进制，无需 base64 中转 |
| **文件导入** | expo-document-picker + xlsx | 56.0 / 0.18.5 | 支持 CSV/Excel 解析，客户端的列名自动映射；xlsx 是 JS 生态最成熟的表格解析库 |
| **动画** | react-native-reanimated | 4.3 | 60fps 原生线程动画，用于图表和 UI 过渡 |
| **图标** | @expo/vector-icons | 15.0 | 内置 Ionicons，统一图标风格 |

### 1.3 未选择的技术及原因

| 技术 | 为何不选 |
|------|----------|
| **SQLite (expo-sqlite)** | v1 曾使用，v2 移除。JSON 文件方案更简单、可读、便于整体导出；个人数据量 (< 10000 条) 无需关系型查询 |
| **AsyncStorage** | 仅支持键值对，无法存储结构化 JSON 文件；不适合导出/导入场景 |
| **MMKV** | 高性能 KV 存储，但同样不支持文件级导出；对当前场景过度设计 |
| **Redux / Zustand** | 当前数据流简单（load → cache → update → save），全局状态管理加重复杂度；React 本地 state + useFocusEffect 已足够 |
| **Supabase / Firebase** | v1 曾用 Supabase，v2 移除。产品定位是"无需登录、数据本地"，云端依赖与此冲突 |
| **Expo Web / react-native-web** | 产品定位为手机 App 安装包分发；本地文件存储、相册、OCR 等能力以原生端为准，不维护浏览器端 |

### 1.4 架构决策记录 (ADR)

| ID | 决策 | 理由 |
|----|------|------|
| ADR-001 | 本地 JSON 文件存储 | 个人数据量小、透明可读、便于整体导出 |
| ADR-002 | 内存缓存 + 防抖写盘 (300ms) | 避免频繁 I/O，性能与数据安全的平衡 |
| ADR-003 | API Key 使用系统安全存储 | 与业务数据和备份包隔离，避免明文落盘 |
| ADR-004 | 图片存文件系统 + JSON 存路径 | 避免 JSON 膨胀 (base64 会使文件增大 33%)，支持独立管理 |
| ADR-005 | 无后端、无认证 | 核心理念"打开即用"，降低隐私顾虑和使用门槛 |
| ADR-006 | 图片路径只存相对名 | 绝对路径随设备与安装实例变化，跨设备导入必然失效；相对名 + `resolveImageUri()` 让备份包开箱可用 |
| ADR-007 | 备份用目录式压缩包而非单文件 | 单文件方案要么 base64 内嵌（体积 +33%、大图易 OOM），要么手写 zip；目录式只需逐文件复制，且电脑上可直接查看 |
| ADR-008 | 导入语义为全量覆盖 | 备份/换机场景下"恢复成当时的样子"才符合直觉；记录级时间戳合并在图片场景会产生孤儿文件与死引用 |

---

## 二、数据模型

### 2.1 实体关系图 (ERD)

```
┌──────────────┐       ┌──────────────┐
│   Profile    │       │   Category   │
│──────────────│       │──────────────│
│ nickname     │       │ id (PK)      │◄──────┐
│ avatarUrl    │       │ name         │       │
└──────────────┘       │ icon         │       │ 1:N
                       │ color        │       │
                       │ parentId (FK)│──┐    │
                       │ sortOrder    │  │    │
                       │ customFields │  │    │
                       │ createdAt    │  │    │
                       │ updatedAt    │  │    │
                       └──────────────┘  │    │
                              │          │    │
                              │ 1:N      │    │
                              ▼          │    │
                       ┌──────────────┐  │    │
                       │    Item      │  │    │
                       │──────────────│  │    │
                       │ id (PK)      │  │    │
                       │ name         │  │    │
                       │ categoryId ──┼──┘    │
                       │ brand        │       │
                       │ purchaseDate │       │
                       │ purchasePrice│       │
                       │ purchasePlat │       │
                       │ storeName    │       │
                       │ location     │       │
                       │ quantity     │       │
                       │ status       │       │
                       │ notes        │       │
                       │ images[]     │       │
                       │ customValues │       │
                       │ createdAt    │       │
                       │ updatedAt    │       │
                       └──────────────┘       │
                                               │
                       ┌──────────────┐       │
                       │ CustomField  │       │
                       │──────────────│       │
                       │ id (PK)      │       │
                       │ name         │       │
                       │ type         │       │
                       │ sortOrder    │       │
                       └──────────────┘       │
                           (嵌入 Category)    │
                                              │
                       ┌──────────────┐       │
                       │  customValues│       │
                       │ (嵌入 Item)  │       │
                       │ {fieldId:val}│       │
                       └──────────────┘       │
```

### 2.2 实体详细定义

#### 2.2.1 WarehouseData (根文档)

整个应用的核心数据容器，序列化为单个 JSON 文件。

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| version | number | ✅ | 3 | 数据格式版本号，读取时按此迁移 |
| lastModified | ISO 8601 | ✅ | now() | 文件最后修改时间 / 备份包导出时间 |
| profile | Profile | ✅ | — | 匣主资料 |
| categories | Category[] | ✅ | [] | 分类列表 |
| items | Item[] | ✅ | [] | 匣中列表（匣物） |

> 版本历史：v1（初版）→ v2（新增删除墓碑）→ **v3（移除墓碑，图片路径改为相对名）**。
> v2 的文件仍可读取，`normalizeWarehouseData` 会把绝对路径改写为 `images/<文件名>`。

#### 2.2.2 Profile (匣主资料)

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| nickname | string | ❌ | "" | 用户昵称 |
| avatarUrl | string \| null | ❌ | null | 头像 data URI（base64 内嵌，因此随 JSON 一起进入备份包） |

#### 2.2.3 Category (分类)

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | UUID v4 | ✅ | auto | 主键 |
| name | string | ✅ | — | 分类名称 |
| icon | string \| null | ❌ | null | emoji 图标，如 "📱" |
| color | string \| null | ❌ | null | 十六进制颜色，如 "#4F46E5" |
| parentId | string \| null | ❌ | null | 父分类 ID（预留，当前未使用） |
| sortOrder | number | ❌ | auto | 排序序号 |
| customFields | CustomField[] | ❌ | [] | 该分类的自定义字段定义 |
| createdAt | ISO 8601 | ✅ | now() | 创建时间 |
| updatedAt | ISO 8601 | ✅ | now() | 最后更新时间 |

#### 2.2.4 CustomField (自定义字段定义)

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | string | ✅ | auto (fld_前缀) | 字段唯一标识 |
| name | string | ✅ | — | 字段显示名称 |
| type | "text" \| "number" \| "date" | ✅ | — | 字段值类型 |
| sortOrder | number | ❌ | auto | 排序序号 |

#### 2.2.5 Item (匣物)

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | UUID v4 | ✅ | auto | 主键 |
| name | string | ✅ | — | 匣物名称 |
| categoryId | string \| null | ❌ | null | 关联分类 ID (FK → Category.id) |
| brand | string \| null | ❌ | null | 品牌 |
| purchaseDate | string \| null | ❌ | null | 购买日期 (YYYY-MM-DD) |
| purchasePrice | number \| null | ❌ | null | 购买价格 (元) |
| purchasePlatform | string \| null | ❌ | null | 购买平台枚举值 |
| storeName | string \| null | ❌ | null | 店铺名称 |
| location | string \| null | ❌ | null | 存放位置 |
| quantity | number | ❌ | 1 | 数量 |
| status | string | ❌ | "使用中" | 匣物状态枚举值 |
| notes | string \| null | ❌ | null | 备注 |
| images | string[] | ❌ | [] | 图片相对名数组，形如 `images/<uuid>.jpg`（见 2.4） |
| customValues | Record<string,string> | ❌ | {} | 自定义字段值 (key=CustomField.id) |
| createdAt | ISO 8601 | ✅ | now() | 创建时间 |
| updatedAt | ISO 8601 | ✅ | now() | 最后更新时间 |

#### 2.2.6 枚举值定义

**匣物状态 (Item.status)**：

| 值 | 含义 | 颜色码 |
|----|------|--------|
| "使用中" | 正在使用 | `#059669` |
| "闲置中" | 闲置未使用 | `#D97706` |
| "已损坏" | 已损坏 | `#DC2626` |
| "已出售" | 已出售 | `#4F46E5` |
| "已送人" | 已赠送他人 | `#7C3AED` |
| "收藏中" | 收藏品 | `#0891B2` |

**购买平台 (Item.purchasePlatform)**：

| 值 |
|----|
| "京东" |
| "淘宝" |
| "拼多多" |
| "实体店" |
| "其他" |

**自定义字段类型 (CustomField.type)**：

| 值 | 说明 | 输入控件 |
|----|------|----------|
| "text" | 文本 | TextInput |
| "number" | 数字 | TextInput (decimal-pad) |
| "date" | 日期 | DatePickerModal |

### 2.3 辅助配置数据

| 文件 | 数据结构 | 用途 |
|------|----------|------|
| `warehouse-ocr-settings.json` | `{ apiKey, apiBase, model }` | AI 配置 |
| `images/*.{jpg,png,webp}` | 二进制文件 | 匣物图片 |

导出产生的备份包（位置由匣主选择，不在应用私有目录内）：

| 路径 | 内容 |
|------|------|
| `物匣备份-<YYYYMMDD-HHmmss>/warehouse-data.json` | 完整数据快照（version 3） |
| `物匣备份-<YYYYMMDD-HHmmss>/images/*` | 对应匣物的全部图片文件 |

### 2.4 数据完整性约束

| 约束 | 说明 |
|------|------|
| Item.categoryId → Category.id | 软外键：删除分类时清空关联匣物的 categoryId，不级联删除 |
| customValues key → CustomField.id | 软外键：切换分类时清空 customValues |
| Item.images[] | **只存相对名** `images/<文件名>`；渲染/落盘时由 `resolveImageUri()` 拼当前设备的 documentDirectory。绝对路径在换机与 iOS 重装后会失效，故一律不入库 |
| 图片文件命名 | UUID + 归一扩展名（`.jpg` / `.png` / `.webp`），保证跨设备同名不冲突 |
| lastModified | 每次写盘自动更新；备份包中即为导出时间 |
| version | 当前为 3，结构变更时递增并在 `normalizeWarehouseData` 中提供迁移 |

---

## 三、API 接口设计

本项目为本地优先 (local-first) 架构，API 分为两层：

- **A 层 — 内部数据 API**：Repository 层接口，React Native 代码直接调用
- **B 层 — 外部服务 API**：调用第三方 LLM 的 HTTP 接口

以下按 RESTful 风格描述所有接口。

---

### A 层 — 内部数据 API (Repository Layer)

#### A.1 匣物 (Items)

```
┌──────────┬──────────┬──────────────────────────────────┐
│  方法     │  路径     │  说明                            │
├──────────┼──────────┼──────────────────────────────────┤
│  LIST    │ /items   │ 获取匣中列表（按创建时间倒序）       │
│  GET     │ /items/:id│ 获取匣物详情（含分类信息）          │
│  CREATE  │ /items   │ 入匣                              │
│  UPDATE  │ /items/:id│ 改匣（部分更新）                   │
│  DELETE  │ /items/:id│ 移出物匣（含关联图片清理）          │
│  SEARCH  │ /items/search?q=&categoryId=&status= │ 搜索  │
│  STATS   │ /items/stats │ 获取统计数据                   │
│  IDLE    │ /items/idle?days=30 │ 获取闲置匣物列表         │
└──────────┴──────────┴──────────────────────────────────┘
```

**LIST /items**
```
返回: ItemSummary[]
排序: createdAt DESC
说明: 列表页使用，仅返回摘要字段（不含 notes、customValues 等）
```

**GET /items/:id**
```
返回: Item | null
说明: 含关联的 Category 名称、customValues 展开值
```

**CREATE /items**
```typescript
请求体: {
  name: string;              // 必填
  categoryId?: string | null;
  brand?: string | null;
  purchaseDate?: string | null;     // YYYY-MM-DD
  purchasePrice?: number | null;
  purchasePlatform?: string | null; // "京东"|"淘宝"|"拼多多"|"实体店"|"其他"
  storeName?: string | null;
  location?: string | null;
  quantity?: number;                // 默认 1
  status?: string;                  // 默认 "使用中"
  notes?: string | null;
  images?: string[];                // 持久化后的文件路径
  customValues?: Record<string, string>;
}
返回: string (新创建的 id)
副作用: 触发 triggerAutoExport()
```

**UPDATE /items/:id**
```typescript
请求体: Partial<CreateItemInput>
返回: void
副作用: updatedAt 自动更新; 触发 triggerAutoExport()
```

**DELETE /items/:id**
```
返回: void
副作用: 删除关联图片文件; 触发 triggerAutoExport()
```

**SEARCH /items/search**
```
参数:
  q?: string           // 关键词 (name/brand/notes 模糊匹配)
  categoryId?: string  // 分类筛选
  status?: string      // 状态筛选
返回: ItemSummary[]    // 最多 50 条，createdAt DESC
```

**STATS /items/stats**
```
返回: {
  total: number;       // 匣中件数
  totalValue: number;  // 总价值 (元)
  idle: number;        // 闲置中数量
  idleOverdue: number; // 超过提醒阈值的闲置数
}
```

**IDLE /items/idle**
```
参数: days?: number    // 阈值天数，默认取 ReminderSettings.idleReminderDays
返回: ItemSummary[]    // 按闲置时长 ASC
条件: status === "闲置中" AND (now - updatedAt) > days
```

#### A.2 分类 (Categories)

```
┌──────────┬──────────────────┬───────────────────────────┐
│  方法     │  路径             │  说明                      │
├──────────┼──────────────────┼───────────────────────────┤
│  LIST    │ /categories      │ 获取分类列表（按 sortOrder）  │
│  CREATE  │ /categories      │ 创建分类（含 customFields）   │
│  UPDATE  │ /categories/:id  │ 更新分类                     │
│  DELETE  │ /categories/:id  │ 删除分类（清空匣物关联）       │
│  ITEMS   │ /categories/:id/items │ 获取分类下匣中列表      │
└──────────┴──────────────────┴───────────────────────────┘
```

**LIST /categories**
```
返回: Category[]
排序: sortOrder ASC
```

**CREATE /categories**
```typescript
请求体: {
  name: string;
  icon?: string | null;       // emoji
  color?: string | null;      // hex color
  customFields?: {
    name: string;
    type: "text" | "number" | "date";
  }[];
}
返回: string (新创建的 id)
```

**UPDATE /categories/:id**
```typescript
请求体: Partial<CreateCategoryInput>
说明: customFields 全量替换（非增量更新）
返回: void
```

**DELETE /categories/:id**
```
返回: void
副作用: 将关联匣物的 categoryId 置为 null（不删除匣物）
```

**ITEMS /categories/:id/items**
```
返回: ItemSummary[]  (该分类下匣物，createdAt DESC)
```

#### A.3 匣主资料 (Profile)

```
┌──────────┬───────────┬────────────┐
│  方法     │  路径      │  说明       │
├──────────┼───────────┼────────────┤
│  GET     │ /profile  │ 获取匣主资料 │
│  UPDATE  │ /profile  │ 更新匣主资料 │
└──────────┴───────────┴────────────┘
```

**GET /profile**
```
返回: { nickname: string; avatarUrl: string | null }
```

**UPDATE /profile**
```typescript
请求体: {
  nickname?: string;
  avatarUrl?: string | null;
}
返回: void
```

#### A.4 数据备份 (Backup)

```
┌──────────┬──────────────────┬──────────────────────┐
│  方法     │  路径             │  说明                 │
├──────────┼──────────────────┼──────────────────────┤
│  EXPORT  │ /backup/export   │ 导出目录式备份包（含图片）│
│  SELECT  │ /backup/select   │ 选择备份包并读取预览     │
│  APPLY   │ /backup/apply    │ 覆盖导入（含图片）       │
└──────────┴──────────────────┴──────────────────────┘
```

**EXPORT /backup/export**
```typescript
参数: onProgress?: (p: { done: number; total: number }) => void
返回: ExportSummary | null      // null = 匣主取消选择
说明: 选目标文件夹 → 新建「物匣备份-<YYYYMMDD-HHmmss>/」→ 写 warehouse-data.json 与 images/
副作用: 无（只读本地数据）
```

**SELECT /backup/select**
```typescript
参数: 无
返回: BackupSelection | null    // null = 匣主取消选择
说明: 选择备份包文件夹（也兼容选中其父文件夹，会向下找一层），解析 JSON 并统计图片缺口
结构: {
  dirName: string;
  backedUpAt: string;           // 备份包的 lastModified
  itemCount: number;
  categoryCount: number;
  imageCount: number;
  missingImages: number;
  apply: (onProgress?) => Promise<ImportSummary>;
}
```

**APPLY /backup/apply**
```typescript
返回: {
  itemCount: number;
  categoryCount: number;
  imageCount: number;
  missingImages: number;        // 备份包中缺失、未能导入的图片数
  prunedImages: number;         // 导入后清理掉的无引用本地图片数
}
说明: 图片以新 UUID 名落地本机 images/ 并改写 JSON 引用，随后整体替换本地数据
      （全量覆盖，不可撤销）；仅在没有图片缺失时才清理无引用图片，
      避免备份本身不完整时把本机唯一副本也删掉
```

#### A.5 图片管理 (Images)

```
┌──────────┬─────────────────┬──────────────────────┐
│  方法     │  路径            │  说明                 │
├──────────┼─────────────────┼──────────────────────┤
│  SAVE    │ /images/save    │ 保存图片到持久化目录    │
│  DELETE  │ /images/delete  │ 删除持久化图片文件      │
└──────────┴─────────────────┴──────────────────────┘
```

**SAVE /images/save**
```typescript
请求体: { uris: string[] }     // 临时文件 URI 数组
返回: string[]                  // 持久化后的文件路径数组
说明: 文件复制到 documentDirectory/images/，以 UUID 重命名
```

**DELETE /images/delete**
```typescript
请求体: { paths: string[] }    // 要删除的文件路径数组
返回: void
```

#### A.6 设置 (Settings)

```
┌──────────┬────────────────────┬───────────────────┐
│  方法     │  路径               │  说明              │
├──────────┼────────────────────┼───────────────────┤
│  GET     │ /settings/ai       │ 获取 AI 配置       │
│  UPDATE  │ /settings/ai       │ 更新 AI 配置       │
│  GET     │ /settings/reminder │ 获取闲置提醒配置    │
│  UPDATE  │ /settings/reminder │ 更新闲置提醒配置    │
└──────────┴────────────────────┴───────────────────┘
```

**GET /settings/ai**
```
返回: { apiKey: string; apiBase: string; model: string }
```

**UPDATE /settings/ai**
```typescript
请求体: { apiKey: string; apiBase: string; model: string }
返回: void
```

**GET /settings/reminder**
```
返回: { idleReminderDays: number }    // 默认 30
```

**UPDATE /settings/reminder**
```typescript
请求体: { idleReminderDays: number }  // 7|14|30|60|90
返回: void
```

#### A.7 数据聚合

```
┌──────────┬───────────────────┬──────────────────────────────┐
│  方法     │  路径              │  说明                         │
├──────────┼───────────────────┼──────────────────────────────┤
│  STATS   │ /analytics/stats  │ 多维度统计数据（图表用）         │
└──────────┴───────────────────┴──────────────────────────────┘
```

**STATS /analytics/stats**
```typescript
返回: {
  categoryDistribution: { label: string; value: number; icon: string; color: string }[];
  platformDistribution: { label: string; value: number; color?: string }[];
  statusDistribution:   { label: string; value: number; color?: string }[];
  monthlySpending:      { label: string; value: number }[];    // 近12个月
  totalItems: number;
  totalValue: number;
}
```

---

### B 层 — 外部服务 API

#### B.1 匣灵问答 (Chat Completions)

```
POST {apiBase}/chat/completions
Content-Type: application/json
Authorization: Bearer {apiKey}
```

```typescript
请求体: {
  model: string;                    // 默认 "gpt-4o-mini"
  messages: [
    { role: "system", content: SYSTEM_PROMPT },  // 角色 + 性格 + 输出规则
    { role: "system", content: "当前匣主的匣中数据如下：\n```json\n{context}\n```" },
    { role: "system", content: "本地预计算结果：\n```json\n{insights}\n```" },
    ...history,                     // { role: "user"|"assistant", content: string }
    { role: "user", content: question }
  ];
  max_tokens: 1500;
  temperature: 0.3;
}

返回: {
  choices: [{ message: { content: string } }];
  // 前端 stripMarkdown 兜底去除残留 markdown
}
```

**SYSTEM_PROMPT 组成**（`lib/ai/personality.ts`）：
- 角色定位：匣灵是有温度、帮匣主管理物匣的伙伴
- 性格片段：由 `OcrSettings.personalityPreset` 决定（温暖 / 可靠 / 高冷 / 自定义）
- 共享输出规则：纯文本、禁止 markdown、排名类直接列出禁止反问、金额加 ¥

**OcrSettings 性格相关字段**（`warehouse-ocr-settings.json`）：
```typescript
{
  personalityPreset: "warm" | "reliable" | "cool" | "custom";  // 默认 warm
  personalityCustom: string;   // 最多 200 字，preset 为 custom 时使用
  itemReviewFollowPersonality: boolean;  // 匣物评价是否跟随性格，默认 true
}
```

**insights 预计算逻辑**（`lib/ai/warehouseInsights.ts`）：
```typescript
{
  最贵匣物: [{ 名称, 分类, 价格, 平台 }],   // Top 5，价格降序
  最近购买: [{ 名称, 分类, 价格, 购买日期 }], // Top 5，日期降序，无日期排后
  平台花费: [{ 平台, 总金额, 件数 }],         // 金额降序
  闲置匣物: [{ 名称, 分类, 价格 }],
  分类统计: [{ 名称, 件数, 总金额 }]
}
```

**context 构建逻辑**：
```typescript
{
  统计: {
    匣中件数, 闲置中, 使用中, 总价值,
    分类列表: [{ 名称, 图标, 匣物数 }]
  },
  匣中列表: [{
    名称, 分类, 品牌, 价格, 平台, 店铺, 位置, 数量, 状态, 备注, 购买日期
  }]
}
```

#### B.2 OCR 订单截图识别 (Vision API)

```
POST {apiBase}/chat/completions
Content-Type: application/json
Authorization: Bearer {apiKey}
```

```typescript
请求体: {
  model: string;                    // 默认 "gpt-4o" (需要视觉能力)
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "请从这张订单截图中提取购买信息" },
      {
        type: "image_url",
        image_url: { url: "data:{mimeType};base64,{base64Image}" }
      }
    ]
  }];
  max_tokens: 500;
  temperature: 0;
}

返回格式（从 model 返回内容中 JSON 正则提取）: {
  name: string;
  brand: string;
  purchasePrice: number;
  purchasePlatform: string;
  storeName: string;
  purchaseDate: string;    // YYYY-MM-DD
  quantity: number;
}
```

**AI 供应商兼容性**：所有兼容 OpenAI Chat Completions 格式的 API 均可使用（OpenAI、DeepSeek、Ollama 等），通过 `apiBase` 和 `model` 配置切换。

---

## 四、项目目录结构

### 4.1 推荐结构

```
apps/mobile/
│
├── app/                              # expo-router 文件路由（页面层）
│   ├── _layout.tsx                   # 根布局 (SafeAreaProvider + Stack)
│   ├── index.tsx                     # 入口 → 重定向 /items
│   └── (tabs)/
│       ├── _layout.tsx               # 底部 Tab 导航（匣中 / 分类 / 搜索 / 匣主）
│       ├── items/                    # 📦 匣中模块（路由名 items）
│       │   ├── _layout.tsx           # Stack navigator
│       │   ├── index.tsx             # 匣中列表页
│       │   ├── add.tsx               # 入匣页
│       │   ├── [id].tsx              # 匣物详情页
│       │   ├── edit/[id].tsx         # 改匣页
│       │   ├── ocr-import.tsx        # OCR 截图入匣页
│       │   ├── file-import.tsx       # 文件批量入匣页
│       │   └── idle.tsx              # 闲置匣物列表页
│       ├── categories/               # 🏷️ 分类模块
│       │   ├── _layout.tsx
│       │   ├── index.tsx             # 分类网格页
│       │   └── [id].tsx              # 分类下匣中列表页
│       ├── search/                   # 🔍 搜索模块
│       │   ├── _layout.tsx
│       │   ├── index.tsx             # 搜索筛选页
│       │   └── qa.tsx                # 匣灵问答页
│       └── profile/                  # 👤 匣主（路由名 profile）
│           ├── _layout.tsx
│           ├── index.tsx             # 匣主主页
│           ├── edit.tsx              # 匣主资料页
│           └── stats.tsx             # 物匣统计页
│
├── lib/                              # 业务逻辑层（非 UI）
│   ├── types.ts                      # 全局类型定义
│   │
│   ├── storage/                      # 持久化层
│   │   ├── jsonStore.ts              # JSON 文件读写 + 内存缓存 + 防抖 + 版本迁移
│   │   ├── backupService.ts          # 目录式备份包导出 / 覆盖导入
│   │   ├── imageStore.ts             # 图片压缩、落盘、删除、孤儿清理
│   │   ├── imagePaths.ts             # 图片路径归一（纯函数，可单测）
│   │   └── reminderSettings.ts       # 闲置提醒设置
│   │
│   ├── repositories/                 # 数据仓储层 (Repository Pattern)
│   │   ├── itemRepository.ts         # 匣物 CRUD + 搜索 + 统计 + 闲置检测
│   │   ├── categoryRepository.ts     # 分类 CRUD
│   │   └── profileRepository.ts      # 匣主资料读写
│   │
│   ├── ocr/                          # 数据导入服务
│   │   ├── ocrService.ts             # AI 视觉识别 + API 配置
│   │   └── fileImportService.ts      # CSV/Excel 解析 + 列名映射
│   │
│   ├── ai/                           # AI 服务
│   │   ├── qaService.ts              # 匣灵问答 (LLM 对话)
│   │   ├── personality.ts            # 匣灵性格预设与输出规则
│   │   ├── warehouseInsights.ts      # 匣中数据本地预计算
│   │   └── itemReviewService.ts      # 匣物 AI 评价
│
├── components/                       # 可复用 UI 组件
│   ├── ItemForm.tsx                  # 匣物表单 (核心复合组件)
│   ├── ItemCard.tsx                  # 匣中列表卡片
│   ├── CategorySheet.tsx             # 分类编辑 BottomSheet
│   ├── CategoryChip.tsx              # 分类标签
│   ├── CategoryBarChart.tsx          # 横向柱状图
│   ├── MonthlySpendingChart.tsx      # 月度消费趋势图
│   ├── ProfileHeader.tsx             # 匣主头部 + 匣主等级
│   ├── StatsRow.tsx                  # 统计数字行
│   ├── StatCard.tsx                  # 单个统计卡片
│   ├── StatusBadge.tsx               # 状态标签
│   ├── SearchBar.tsx                 # 寻觅输入框
│   ├── DatePickerModal.tsx           # 日期选择器
│   ├── AiSettingsCard.tsx            # AI 配置卡片
│   ├── DataSettingsCard.tsx          # 数据备份卡片（导出 / 导入）
│   ├── ReminderSettingsCard.tsx      # 闲置提醒设置卡片
│   ├── IdleReminderBanner.tsx        # 闲置提醒横幅
│   ├── EmptyState.tsx                # 空状态占位
│   └── ConfirmDialog.tsx             # 确认弹窗
│
├── scripts/                         # 构建期脚本（prebuild 之后改原生配置）
│   └── apply-release-signing.js     # 注入 release 正式签名
│
├── assets/                           # 静态资源
│   ├── icon.png                      # App 图标
│   ├── splash-icon.png               # 启动屏图标
│   └── adaptive-icon.png             # Android 自适应图标
│
├── database/                         # 参考文档（无运行时作用）
│   └── (遗留 SQL DDL，仅作参考)
│
├── dist/                             # 构建产物
├── logs/                             # 构建日志
│
├── app.json                          # Expo 配置
├── package.json                      # 依赖管理
├── tsconfig.json                     # TypeScript 配置
├── .gitignore                        # Git 忽略规则
├── AGENTS.md                         # 品牌用语与编码约定
├── README.md                         # 项目说明
└── CHANGELOG.md                      # 版本变更记录
```

### 4.2 分层职责

```
┌─────────────────────────────────────────────────────┐
│  app/          Page Layer        页面 + 路由         │
│  ─────────────────────────────────────────────────  │
│  • 仅负责 UI 渲染和用户交互                            │
│  • 通过 Repository 获取数据                           │
│  • 不直接操作 jsonStore / FileSystem                  │
├─────────────────────────────────────────────────────┤
│  components/   Component Layer   可复用 UI 组件       │
│  ─────────────────────────────────────────────────  │
│  • 纯展示组件：接收 props，渲染 UI                     │
│  • 复合组件 (ItemForm)：含本地交互状态                 │
│  • 不持有全局状态，不直接访问数据层                     │
├─────────────────────────────────────────────────────┤
│  lib/repositories/  Data Access  数据仓储层          │
│  ─────────────────────────────────────────────────  │
│  • 封装所有 CRUD 操作                                 │
│  • 类型安全：输入/输出类型来自 types.ts                │
│  • 调用 jsonStore 进行读写                            │
├─────────────────────────────────────────────────────┤
│  lib/storage/      Infrastructure  基础设施层        │
│  ─────────────────────────────────────────────────  │
│  • jsonStore：文件 I/O、缓存、防抖、版本迁移          │
│  • backupService：备份包导出、覆盖导入                │
│  • imageStore：图片压缩与文件管理                     │
├─────────────────────────────────────────────────────┤
│  lib/ocr/ lib/ai/  External Services  外部服务       │
│  ─────────────────────────────────────────────────  │
│  • OCR 识别 + CSV 解析                               │
│  • 匣灵问答                                         │
└─────────────────────────────────────────────────────┘
```

### 4.3 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 页面文件 | kebab-case / expo-router 约定 | `file-import.tsx`, `[id].tsx` |
| 组件文件 | PascalCase | `ItemCard.tsx`, `CategorySheet.tsx` |
| 服务/仓储 | camelCase | `itemRepository.ts`, `qaService.ts` |
| 类型文件 | camelCase | `types.ts` |
| 文件夹 | kebab-case / expo-router 约定 | `(tabs)`, `edit/[id]` |
| 类型/接口 | PascalCase | `Item`, `CreateItemInput` |
| 变量/函数 | camelCase | `loadData`, `handleSave` |
| 常量 | UPPER_SNAKE_CASE | `PLATFORMS`, `SYSTEM_PROMPT` |

---

## 五、外部服务集成

### 5.1 AI 服务集成架构

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│   OCR Page   │────▶│   ocrService.ts   │────▶│             │
│  (截图识别)   │     │  (Vision API)     │     │  OpenAI /   │
└──────────────┘     └──────────────────┘     │  DeepSeek / │
                                              │  Custom     │
┌──────────────┐     ┌──────────────────┐     │  API        │
│   QA Page    │────▶│   qaService.ts    │────▶│             │
│  (匣灵问答) │     │  (Chat API)       │     │             │
└──────────────┘     └──────────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │ ocrService  │
                    │ .getOcr     │  共享同一份 API 配置
                    │ Settings()  │  (warehouse-ocr-settings.json)
                    └─────────────┘
```

### 5.2 API 配置模型

```typescript
interface OcrSettings {
  apiKey: string;       // 用户自备 API Key
  apiBase: string;      // API 端点，默认 https://api.openai.com/v1
  model: string;        // 模型名，默认 gpt-4o
}
```

### 5.3 供应商预设

| 供应商 | apiBase | 默认 model | 特点 |
|--------|---------|-----------|------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` | 视觉能力强，价格较高 |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` | 性价比高，中文友好 |
| 自定义 | 用户输入 | 用户输入 | 兼容 Ollama / 本地模型等 |

### 5.4 错误处理策略

| 错误类型 | 处理方式 |
|----------|----------|
| API Key 未配置 | 提示「请先在设置中配置 AI 接口」 |
| 网络错误 | 显示原始错误信息（截断至 200 字符） |
| HTTP 非 200 | 显示 `AI 请求失败 ({status}): {body前200字符}` |
| OCR JSON 解析失败 | 显示 `无法解析识别结果: {content前200字符}` |
| CSV 列名未识别 | 显示 `未识别到商品名称列。请确保 CSV 包含以下列之一：...` |

---

## 六、安全与权限

### 6.1 数据安全

| 项目 | 策略 |
|------|------|
| 数据存储 | 本地文件系统，不传输到任何第三方服务器 |
| API Key | 仅存储于系统安全存储；配置文件与备份包均不包含密钥 |
| 数据传输 | AI 调用使用 HTTPS；物匣数据仅在匣主主动提问时作为上下文发送给 LLM |
| 备份包 | 明文 JSON + 原始图片，落在匣主自选的位置；App 不做额外加密，由匣主自行决定存放与分享范围 |

### 6.2 Android 权限

```xml
READ_EXTERNAL_STORAGE    — 历史遗留（原云盘同步文件夹读写，当前代码已无使用方）
WRITE_EXTERNAL_STORAGE   — 同上
INTERNET                 — AI API 调用
RECORD_AUDIO             — (预留，当前未使用)
```

> 导出/导入走 SAF（`Directory.pickDirectoryAsync`）**按次授权**，只拿到匣主选中的那一个目录，
> 不再依赖 `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE`。
> 上面两条权限目前仍留在 `app.json` 里，属于历史声明；移除前需真机回归相册选图与截图识别链路。

### 6.3 隐私说明

- 所有数据存储在设备本地，不上传至任何云端数据库
- AI 调用时物匣数据作为上下文发送，匣主应知晓此行为
- JSON 文件明文存储，用户可随时查看、备份、删除

---

## 七、构建与部署（手机 App）

本项目仅构建并部署到手机端（Android APK 为主路径；iOS 按需）。不提供 Web 构建或静态站点发布。

### 7.1 构建平台

| 项 | 说明 |
|------|------|
| 主路径 | CNB（cnb.cool 云原生构建），配置见仓库根 `.cnb.yml` |
| 备份路径 | GitHub Actions，配置见 `.github/workflows/build-android.yml` |
| 工具链 | `.cnb/Dockerfile.android`：JDK 17 + Node 22 + SDK 36 + build-tools 36.0.0 + NDK 27.1.12297006，经 `docker:cache` 构建后跨构建节点复用 |
| 构建步骤 | `npm ci` → `npx expo prebuild --platform android --clean` → 注入正式签名 → `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` |
| 产物 | `apps/mobile/android/app/build/outputs/apk/release/*.apk`，作为构建制品上传 |

构建链路不依赖 EAS / Expo 云服务：`expo prebuild` 产出原生工程后由 gradle 自行出包，
因此 `eas.json`、`.easignore`、`eas-cli` 与 `app.json` 中的 Expo Project ID 均已移除。

### 7.2 版本号规则

项目**有意维护两套独立的版本号**，它们处于不同命名空间，不要求同号：

| 线 | 位置 | 作用 | 递增规则 |
|----|------|------|---------|
| **App 版本** `version` | `app.json` → `expo.version` | 语义化版本，给用户看（如 `2.0.0`） | 发版时按改动幅度递增（修 bug 末位 +1，加功能中位 +1） |
| **App 版本** `versionCode` | `app.json` → `expo.android.versionCode` | 整数，Android 据此判断能否覆盖安装 | **每次发版必须 +1，只增不减**；否则用户装不上新版 |
| **功能版本** | [apps/mobile/CHANGELOG.md](../apps/mobile/CHANGELOG.md) 版本头 | 功能里程碑，记录功能与行为变更 | 有功能或行为变更时递增，与 App 版本独立 |

> ⚠️ 历史上两套号一度脱节：5 月的 v1.0.0/v2.0.0/v3.0.0 只写进了 CHANGELOG，
> 从未写入 `app.json`（当时该字段缺省，一律显示 Expo 默认的 1.0.0）。
> 阅读 CHANGELOG 时**不要**把它当作 App 版本。

### 7.3 签名

```
1. keystore 本地存放于 .secrets/（已 gitignore），CI 侧存放于 CNB 密钥仓库 / GitHub Secrets
2. 密钥以 base64 经 imports / secrets 注入环境变量 → 构建阶段解码 → 构建结束立即删除
3. scripts/apply-release-signing.js 在 prebuild 之后把 release buildType
   由模板自带的 signingConfigs.debug 改为 signingConfigs.release
4. 缺密钥直接失败（--require）；不设 debug 兜底——签名不同的包无法覆盖安装
```

> ⚠️ 首次从调试签名切换到正式签名后，已装设备必须**先卸载再装新版**（Android 不允许签名变更的覆盖安装）。
> 卸载会清空应用私有目录，请先在「匣主 → 数据备份」导出数据（含图片），装好后用同一份备份包导入。

### 7.4 更新流程（安装包）

```
1. 代码提交 → CNB 自动构建（push 命中 apps/mobile/** 等路径），或页面按钮手动触发
2. 构建完成后从该次构建的「制品」下载 APK
3. 分发给用户，用户覆盖安装，本地数据保留
4. 无 OTA 通道：JS 与原生改动一律经新安装包生效
```

### 7.5 版本信息

| 属性 | 值 |
|------|-----|
| 部署形态 | 手机 App（非 Web） |
| App 版本 | 见 [apps/mobile/app.json](../apps/mobile/app.json) → `expo.version`（单一来源，不在此复制） |
| Android versionCode | 同上 → `expo.android.versionCode` |
| 功能版本 | 见 [apps/mobile/CHANGELOG.md](../apps/mobile/CHANGELOG.md) 顶部版本头 |
| Android 包名 | com.sjc.wuxia |
| 签名指纹 | SHA1 44:8B:9C:0E:4D:2C:82:55:F1:58:E3:55:97:E6:F2:1E:E9:C0:47:D2 |

> 本表只记录**稳定属性**。版本号会随每次发版变动，因此不再复制到这里 ——
> 过去这里硬编码过「1.0.0 / vc 1」，结果在三次发版后变成了过期快照，
> 反而误导人以为那就是当前版本。构建日志会打印本次实际版本。

---

## 附录 A：数据流图

```
用户操作
   │
   ▼
Page (app/)  ──调用──▶  Repository (lib/repositories/)
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
              loadData()  updateData() 其他
                    │         │
                    ▼         ▼
              jsonStore.ts  (内存缓存 + 防抖写盘)
                    │
                    ▼
           expo-file-system
           (warehouse-data.json + images/)
                    │
                    ▼ (匣主主动触发)
           backupService.ts
           exportBackup()
                    │
                    ▼
           物匣备份-<时间戳>/
             ├ warehouse-data.json
             └ images/
```

> 写盘与备份完全解耦：日常增删改只落本地文件（防抖 300ms），
> 备份只在匣主点击「导出数据」时发生，不再有后台自动上传。

## 附录 B：备份包结构

```
物匣备份-20261008-143045/
├── warehouse-data.json          # 完整数据快照，version 3，images 为相对名
└── images/
    ├── <uuid>.jpg
    └── <uuid>.png

导出: 遍历 items[].images 去重 → 逐张 File.copy() 到 images/ → 缺失文件计入 missingImages
导入: 读 JSON → 校验结构 → 逐张复制到本机 images/（重新生成 UUID 名）
      → 按「包内文件名 → 本机相对名」映射改写引用 → replaceData() 整体覆盖
      → 无图片缺失时 pruneOrphanImages() 清理无引用文件
```

---

> 本文档基于实际代码 `apps/mobile/` 编写，所有接口签名、类型定义、文件路径均与源码一致。
> 最后验证时间：2026-10-08
