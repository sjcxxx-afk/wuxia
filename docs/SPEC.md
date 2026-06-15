# 个人仓库管理系统 — 技术规范文档 (SPEC v3.0)

> 版本：v3.0.0 | 更新：2026-06-15 | 基于 PRD v3.0 编写

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

```
┌──────────────────────────────────────────┐
│              Presentation Layer           │
│   React Native 0.85 + Expo SDK 56         │
│   expo-router (file-based navigation)     │
├──────────────────────────────────────────┤
│              Application Layer            │
│   Repository Pattern (数据仓储层)          │
│   Service Layer (AI / OCR / Sync)         │
├──────────────────────────────────────────┤
│              Infrastructure Layer         │
│   expo-file-system (JSON + Image I/O)     │
│   expo-updates (OTA 热更新)               │
│   expo-image-picker / document-picker     │
└──────────────────────────────────────────┘
```

### 1.2 技术栈明细与选型理由

| 类别 | 技术 | 版本 | 选型理由 |
|------|------|------|----------|
| **框架** | React Native | 0.85.3 | 跨平台移动端首选，单套代码覆盖 Android/iOS/Web；活跃社区 + Meta 官方维护 |
| **工具链** | Expo SDK | 56 | 免原生配置的开发体验；托管构建 (EAS)、OTA 更新、插件生态；大幅降低 RN 入门门槛 |
| **路由** | expo-router | 56.2 | 文件系统路由（类 Next.js），约定优于配置；支持 Stack/Tabs 嵌套、动态路由、深层链接 |
| **语言** | TypeScript | 6.0 | 静态类型检查，减少运行时错误；完善的 IDE 智能提示 |
| **存储** | expo-file-system | 56.0 | 单 JSON 文件方案：零数据库依赖、数据透明可读、云盘友好；适合个人工具的小数据量场景 |
| **图片** | expo-image-picker | 56.0 | 系统级相册选择，支持多选 + 质量压缩；与 expo-file-system 协同存储 |
| **文件导入** | expo-document-picker + xlsx | 56.0 / 0.18.5 | 支持 CSV/Excel 解析，客户端的列名自动映射；xlsx 是 JS 生态最成熟的表格解析库 |
| **动画** | react-native-reanimated | 4.3 | 60fps 原生线程动画，用于图表和 UI 过渡 |
| **更新** | expo-updates | 56.0 | OTA 热更新：无需应用商店审核即可推送 JS Bundle 更新 |
| **图标** | @expo/vector-icons | 15.0 | 内置 Ionicons，统一图标风格 |

### 1.3 未选择的技术及原因

| 技术 | 为何不选 |
|------|----------|
| **SQLite (expo-sqlite)** | v1 曾使用，v2 移除。JSON 文件方案更简单、可读、云盘同步友好；个人数据量 (< 10000 条) 无需关系型查询 |
| **AsyncStorage** | 仅支持键值对，无法存储结构化 JSON 文件；不适合导出/导入场景 |
| **MMKV** | 高性能 KV 存储，但同样不支持文件级导出；对当前场景过度设计 |
| **Redux / Zustand** | 当前数据流简单（load → cache → update → save），全局状态管理加重复杂度；React 本地 state + useFocusEffect 已足够 |
| **Supabase / Firebase** | v1 曾用 Supabase，v2 移除。产品定位是"无需登录、数据本地"，云端依赖与此冲突 |

### 1.4 架构决策记录 (ADR)

| ID | 决策 | 理由 |
|----|------|------|
| ADR-001 | 本地 JSON 文件存储 | 个人数据量小、透明可读、云盘同步友好 |
| ADR-002 | 内存缓存 + 防抖写盘 (300ms) | 避免频繁 I/O，性能与数据安全的平衡 |
| ADR-003 | API Key 独立文件存储 | 敏感信息与业务数据隔离，方便用户选择性同步 |
| ADR-004 | 图片存文件系统 + JSON 存路径 | 避免 JSON 膨胀 (base64 会使文件增大 33%)，支持独立管理 |
| ADR-005 | 无后端、无认证 | 核心理念"打开即用"，降低隐私顾虑和使用门槛 |

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
| version | number | ✅ | 1 | 数据格式版本号，用于未来迁移 |
| lastModified | ISO 8601 | ✅ | now() | 文件最后修改时间，用于同步对比 |
| profile | Profile | ✅ | — | 用户个人资料 |
| categories | Category[] | ✅ | [] | 分类列表 |
| items | Item[] | ✅ | [] | 物品列表 |

#### 2.2.2 Profile (个人资料)

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| nickname | string | ❌ | "" | 用户昵称 |
| avatarUrl | string \| null | ❌ | null | 头像文件路径或 URI |

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

#### 2.2.5 Item (物品)

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | UUID v4 | ✅ | auto | 主键 |
| name | string | ✅ | — | 物品名称 |
| categoryId | string \| null | ❌ | null | 关联分类 ID (FK → Category.id) |
| brand | string \| null | ❌ | null | 品牌 |
| purchaseDate | string \| null | ❌ | null | 购买日期 (YYYY-MM-DD) |
| purchasePrice | number \| null | ❌ | null | 购买价格 (元) |
| purchasePlatform | string \| null | ❌ | null | 购买平台枚举值 |
| storeName | string \| null | ❌ | null | 店铺名称 |
| location | string \| null | ❌ | null | 存放位置 |
| quantity | number | ❌ | 1 | 数量 |
| status | string | ❌ | "使用中" | 物品状态枚举值 |
| notes | string \| null | ❌ | null | 备注 |
| images | string[] | ❌ | [] | 图片文件路径数组 |
| customValues | Record<string,string> | ❌ | {} | 自定义字段值 (key=CustomField.id) |
| createdAt | ISO 8601 | ✅ | now() | 创建时间 |
| updatedAt | ISO 8601 | ✅ | now() | 最后更新时间 |

#### 2.2.6 枚举值定义

**物品状态 (Item.status)**：

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
| `warehouse-sync-settings.json` | `{ syncFolderPath, autoSyncEnabled, syncMode }` | 同步配置 |
| `images/*.{jpg,png,webp}` | 二进制文件 | 物品图片 |

### 2.4 数据完整性约束

| 约束 | 说明 |
|------|------|
| Item.categoryId → Category.id | 软外键：删除分类时清空关联物品的 categoryId，不级联删除 |
| customValues key → CustomField.id | 软外键：切换分类时清空 customValues |
| Item.images[] | 路径必须指向 documentDirectory/images/ 下的持久化文件 |
| lastModified | 每次写盘自动更新，用于同步时间戳比较 |
| version | 当前固定为 1，未来数据迁移时递增 |

---

## 三、API 接口设计

本项目为本地优先 (local-first) 架构，API 分为两层：

- **A 层 — 内部数据 API**：Repository 层接口，React Native 代码直接调用
- **B 层 — 外部服务 API**：调用第三方 LLM 的 HTTP 接口

以下按 RESTful 风格描述所有接口。

---

### A 层 — 内部数据 API (Repository Layer)

#### A.1 物品 (Items)

```
┌──────────┬──────────┬──────────────────────────────────┐
│  方法     │  路径     │  说明                            │
├──────────┼──────────┼──────────────────────────────────┤
│  LIST    │ /items   │ 获取物品列表（按创建时间倒序）       │
│  GET     │ /items/:id│ 获取物品详情（含分类信息）          │
│  CREATE  │ /items   │ 创建物品                          │
│  UPDATE  │ /items/:id│ 更新物品（部分更新）               │
│  DELETE  │ /items/:id│ 删除物品（含关联图片清理）          │
│  SEARCH  │ /items/search?q=&categoryId=&status= │ 搜索  │
│  STATS   │ /items/stats │ 获取统计数据                   │
│  IDLE    │ /items/idle?days=30 │ 获取闲置物品列表         │
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
  total: number;       // 物品总数
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
│  DELETE  │ /categories/:id  │ 删除分类（清空物品关联）       │
│  ITEMS   │ /categories/:id/items │ 获取分类下物品列表      │
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
副作用: 将关联物品的 categoryId 置为 null（不删除物品）
```

**ITEMS /categories/:id/items**
```
返回: ItemSummary[]  (该分类下物品，createdAt DESC)
```

#### A.3 个人资料 (Profile)

```
┌──────────┬───────────┬────────────┐
│  方法     │  路径      │  说明       │
├──────────┼───────────┼────────────┤
│  GET     │ /profile  │ 获取个人资料 │
│  UPDATE  │ /profile  │ 更新个人资料 │
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

#### A.4 同步 (Sync)

```
┌──────────┬─────────────────┬──────────────┐
│  方法     │  路径            │  说明         │
├──────────┼─────────────────┼──────────────┤
│  EXPORT  │ /sync/export    │ 导出到指定路径  │
│  IMPORT  │ /sync/import    │ 从指定路径导入  │
│  CHECK   │ /sync/check     │ 检查远程更新    │
│  SETTINGS│ /sync/settings  │ 同步设置 CRUD  │
└──────────┴─────────────────┴──────────────┘
```

**EXPORT /sync/export**
```typescript
参数: targetPath: string       // 目标文件夹路径
返回: void
说明: 在 targetPath 下生成 warehouse-data.json
```

**IMPORT /sync/import**
```typescript
参数: sourcePath: string       // 源文件路径
返回: void
说明: 读取 sourcePath 中的 JSON，按记录级时间戳合并到本地
```

**CHECK /sync/check**
```
返回: {
  hasUpdate: boolean;
  remoteTime: string | null;   // 云端文件 lastModified
  localTime: string | null;    // 本地文件 lastModified
}
```

**SETTINGS /sync/settings**
```typescript
// GET
返回: {
  syncFolderPath: string;
  autoSyncEnabled: boolean;
  syncMode: "every_change" | "every_5min" | "every_30min";
}

// UPDATE
请求体: Partial<SyncSettings>
返回: void
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

#### B.1 AI 问答 (Chat Completions)

```
POST {apiBase}/chat/completions
Content-Type: application/json
Authorization: Bearer {apiKey}
```

```typescript
请求体: {
  model: string;                    // 默认 "gpt-4o"
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: "当前用户的物品数据如下：\n```json\n{context}\n```" },
    ...history,                     // { role: "user"|"assistant", content: string }
    { role: "user", content: question }
  ];
  max_tokens: 1500;
  temperature: 0.3;
}

返回: {
  choices: [{ message: { content: string } }];
  // 其他字段忽略
}
```

**SYSTEM_PROMPT 摘要**：你是一个个人仓库管理助手。用户会向你询问关于ta物品仓库中的各种问题。回答规则：中文、友好简洁、金额加¥、列举时"物品名 - 分类 - 价格"格式、排名类列Top5、无法回答时坦诚告知。

**context 构建逻辑**：
```typescript
{
  统计: {
    物品总数, 闲置中, 使用中, 总价值,
    分类列表: [{ 名称, 图标, 物品数 }]
  },
  物品列表: [{
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
warehouse-app/
│
├── app/                              # expo-router 文件路由（页面层）
│   ├── _layout.tsx                   # 根布局 (SafeAreaProvider + UpdateBanner + Stack)
│   ├── index.tsx                     # 入口 → 重定向 /items
│   └── (tabs)/
│       ├── _layout.tsx               # 底部 Tab 导航 (4 tabs)
│       ├── items/                    # 📦 物品模块
│       │   ├── _layout.tsx           # Stack navigator
│       │   ├── index.tsx             # 物品列表页
│       │   ├── add.tsx               # 添加物品页
│       │   ├── [id].tsx              # 物品详情页
│       │   ├── edit/[id].tsx         # 编辑物品页
│       │   ├── ocr-import.tsx        # OCR 截图导入页
│       │   ├── file-import.tsx       # 文件批量导入页
│       │   └── idle.tsx              # 闲置物品列表页
│       ├── categories/               # 🏷️ 分类模块
│       │   ├── _layout.tsx
│       │   ├── index.tsx             # 分类网格页
│       │   └── [id].tsx              # 分类下物品列表页
│       ├── search/                   # 🔍 搜索模块
│       │   ├── _layout.tsx
│       │   ├── index.tsx             # 搜索筛选页
│       │   └── qa.tsx                # AI 问答页
│       └── profile/                  # 👤 个人中心
│           ├── _layout.tsx
│           ├── index.tsx             # 个人中心主页
│           ├── edit.tsx              # 编辑资料页
│           └── stats.tsx             # 数据统计页
│
├── src/                              # 业务逻辑层（非 UI）
│   ├── types.ts                      # 全局类型定义
│   │
│   ├── storage/                      # 持久化层
│   │   ├── jsonStore.ts              # JSON 文件读写 + 内存缓存 + 防抖
│   │   ├── syncService.ts            # 导出/导入/合并/自动同步
│   │   ├── syncSettings.ts           # 同步设置管理
│   │   ├── imageStore.ts             # 图片文件管理
│   │   └── reminderSettings.ts       # 闲置提醒设置
│   │
│   ├── repositories/                 # 数据仓储层 (Repository Pattern)
│   │   ├── itemRepository.ts         # 物品 CRUD + 搜索 + 统计 + 闲置检测
│   │   ├── categoryRepository.ts     # 分类 CRUD
│   │   └── profileRepository.ts      # 个人资料读写
│   │
│   ├── ocr/                          # 数据导入服务
│   │   ├── ocrService.ts             # AI 视觉识别 + API 配置
│   │   └── fileImportService.ts      # CSV/Excel 解析 + 列名映射
│   │
│   ├── ai/                           # AI 服务
│   │   └── qaService.ts              # 智能问答 (LLM 对话)
│   │
│   └── updates/                      # 更新服务
│       └── useAppUpdates.ts          # expo-updates Hook
│
├── components/                       # 可复用 UI 组件
│   ├── ItemForm.tsx                  # 物品表单 (核心复合组件)
│   ├── ItemCard.tsx                  # 物品列表卡片
│   ├── CategorySheet.tsx             # 分类编辑 BottomSheet
│   ├── CategoryChip.tsx              # 分类标签
│   ├── CategoryBarChart.tsx          # 横向柱状图
│   ├── MonthlySpendingChart.tsx      # 月度消费趋势图
│   ├── ProfileHeader.tsx             # 个人资料头部 + 等级系统
│   ├── StatsRow.tsx                  # 统计数字行
│   ├── StatCard.tsx                  # 单个统计卡片
│   ├── StatusBadge.tsx               # 状态标签
│   ├── SearchBar.tsx                 # 搜索输入框
│   ├── DatePickerModal.tsx           # 日期选择器
│   ├── AiSettingsCard.tsx            # AI 配置卡片
│   ├── SyncSettingsCard.tsx          # 同步设置卡片
│   ├── ReminderSettingsCard.tsx      # 闲置提醒设置卡片
│   ├── UpdateBanner.tsx              # OTA 更新横幅
│   ├── IdleReminderBanner.tsx        # 闲置提醒横幅
│   ├── EmptyState.tsx                # 空状态占位
│   └── ConfirmDialog.tsx             # 确认弹窗
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
├── eas.json                          # EAS Build 配置
├── package.json                      # 依赖管理
├── tsconfig.json                     # TypeScript 配置
├── .gitignore                        # Git 忽略规则
├── AGENTS.md                         # AI Agent 上下文说明
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
│  src/repositories/  Data Access  数据仓储层          │
│  ─────────────────────────────────────────────────  │
│  • 封装所有 CRUD 操作                                 │
│  • 类型安全：输入/输出类型来自 types.ts                │
│  • 调用 jsonStore 进行读写                            │
├─────────────────────────────────────────────────────┤
│  src/storage/      Infrastructure  基础设施层        │
│  ─────────────────────────────────────────────────  │
│  • jsonStore：文件 I/O、缓存、防抖                    │
│  • syncService：同步逻辑、合并策略                    │
│  • imageStore：图片文件管理                           │
├─────────────────────────────────────────────────────┤
│  src/ocr/ src/ai/  External Services  外部服务       │
│  ─────────────────────────────────────────────────  │
│  • OCR 识别 + CSV 解析                               │
│  • AI 问答                                           │
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
│  (AI 问答)   │     │  (Chat API)       │     │             │
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
| API Key 未配置 | 提示"请先在「我的」页面配置 AI 接口" |
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
| API Key | 明文存储于本地 `warehouse-ocr-settings.json`；UI 输入框使用 `secureTextEntry` |
| 数据传输 | AI 调用使用 HTTPS；仓库数据仅在用户主动提问时作为上下文发送给 LLM |
| 同步文件 | 依赖云盘软件自身的加密传输；App 不做额外加密 |

### 6.2 Android 权限

```xml
READ_EXTERNAL_STORAGE    — 读取云盘同步文件夹
WRITE_EXTERNAL_STORAGE   — 写入云盘同步文件夹
INTERNET                 — AI API 调用 + OTA 更新
RECORD_AUDIO             — (预留，当前未使用)
```

### 6.3 隐私说明

- 所有数据存储在设备本地，不上传至任何云端数据库
- AI 调用时仓库数据作为上下文发送，用户应知晓此行为
- JSON 文件明文存储，用户可随时查看、备份、删除

---

## 七、构建与部署

### 7.1 构建配置

```json
// eas.json 构建 profile
{
  "development": { "developmentClient": true, "android": { "buildType": "apk" } },
  "preview":     { "android": { "buildType": "apk" }, "channel": "preview" },
  "production":  { "channel": "production" }
}
```

### 7.2 更新通道

```
development ──▶ 开发调试用，不推送 OTA
preview     ──▶ 内测版本，可推送 OTA 到 preview channel
production  ──▶ 正式版本，推送 OTA 到 production channel
```

### 7.3 OTA 更新流程

```
1. 代码提交 → EAS Update 发布
2. expo-updates 在 App 启动/回到前台时自动检查
3. 发现新版本 → 后台静默下载
4. 下载完成 → UpdateBanner 显示 "新版本已就绪 · 立即重启"
5. 用户点击 → reloadAsync() 应用更新
```

### 7.4 版本信息

| 属性 | 值 |
|------|-----|
| App 版本 | 1.0.0 (app.json version) |
| 功能版本 | v3.0.0 (CHANGELOG 语义化版本) |
| Android 包名 | com.sjc.warehouse |
| Expo Project ID | 950b0259-57d0-4392-aaa1-05a181d1567f |
| Runtime Version | appVersion (跟随 app.json version) |

---

## 附录 A：数据流图

```
用户操作
   │
   ▼
Page (app/)  ──调用──▶  Repository (src/repositories/)
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
           (warehouse-data.json)
                    │
                    ▼ (若开启自动同步)
           syncService.ts
           triggerAutoExport()
                    │
                    ▼
           云盘同步文件夹
```

## 附录 B：同步合并算法

```
输入: localData, remoteData (均为 WarehouseData)
输出: mergedData

算法:
1. 建立 itemMap: Map<id, Item>
   - 遍历 localData.items, 放入 itemMap
   - 遍历 remoteData.items:
     - 若 id 不在 itemMap 中 → 添加
     - 若 id 存在且 remote.item.updatedAt > local.item.updatedAt → 覆盖

2. 建立 catMap: Map<id, Category>  (同上逻辑)

3. profile: remote 优先（若非空），否则用 local

4. 返回 { version: 1, lastModified: now(), profile, categories, items }
```

---

> 本文档基于实际代码 `warehouse-app/` 编写，所有接口签名、类型定义、文件路径均与源码一致。
> 最后验证时间：2026-06-15
