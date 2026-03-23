# The Agent Company 整合计划

> 基于 The Agent Company，融合 Vibe-Kanban、OpenClaw Control Center、ClawX 的统一管理平台
> 核心定位：让非技术用户搭建自己的 AI 工作流（v2.0 修正：工作流第一公民，多 agent 降权）

---

## 一、四个项目分析

| 项目 | 核心定位 | 技术栈 | 我们要用的部分 |
|---|---|---|---|
| **The Agent Company** (base) | AI agent 团队编排：org chart、goals、budgets、governance、tickets | Node.js + React 19 + Vite + Radix UI + Tailwind + Tanstack Query + PostgreSQL | **全部保留**作为基座 |
| **Vibe-Kanban** | Coding agent 的 Kanban 看板 + workspace 管理 | React 18 + Rust backend + Radix UI + Tailwind + dnd-kit + Zustand + i18next | Kanban 视图组件、拖拽交互逻辑 |
| **OpenClaw Control Center** | OpenClaw 可观测性面板：usage、staff、memory、docs、collaboration | 纯 Node.js + server-rendered HTML（无前端框架） | 数据采集逻辑 + 页面概念设计（Overview/Usage/Staff/Memory/Docs/Collaboration/Settings） |
| **ClawX** | OpenClaw 桌面 GUI：配置 models、channels、skills、cron | Electron + React 19 + Vite + Radix UI + Tailwind + shadcn/ui + Zustand | 配置管理 UI（models、channels、skills、cron）、i18n 框架、light/dark mode |

---

## 二、功能去重与合并

### 重叠功能对照表

| 功能 | The Agent Company | Vibe-Kanban | Control Center | ClawX | 合并策略 |
|---|---|---|---|---|---|
| 任务管理 | ✅ Tickets + Goals | ✅ Kanban Issues | ✅ Tasks 面板 | ❌ | The Agent Company ticket 为数据层 + Kanban 为视图层，Control Center tasks 合并进来 |
| Agent 管理 | ✅ Org chart + Roles | ❌ | ✅ Staff 面板 | ❌ | 统一为双层 agent 模型（见下方 Agent 命名） |
| 成本/Usage | ✅ Budget per agent | ❌ | ✅ Usage 面板（详细） | ❌ | 合并：The Agent Company budget + Control Center usage 详情 |
| 配置管理 | ❌ | ❌ | ✅ Settings（只读） | ✅ Models/Channels/Skills/Cron（可写） | 采用 ClawX 的可写配置 UI，融入 Settings 页 |
| Memory/Docs | ❌ | ❌ | ✅ Memory + Documents | ❌ | 直接移植 Control Center 的概念 |
| i18n | ❌ | ✅ i18next | ❌（手动双语） | ✅ i18next | 采用 i18next，ClawX 的翻译资源为起点 |
| 主题 | ❌（暗色为主） | ✅ 有 light/dark | ❌ | ✅ light/dark/system | 统一用 The Agent Company 的 Tailwind 主题 token + ClawX 的切换机制 |
| 审批/治理 | ✅ Governance | ❌ | ✅ Approvals（只读） | ❌ | The Agent Company 治理为主，Control Center 审批视图合并 |
| 协作 | ❌ | ❌ | ✅ Collaboration（session 间通信） | ❌ | 移植到 The Agent Company |

---

## 三、统一 Agent 模型（核心设计）

### 问题

The Agent Company 和 OpenClaw 各自发明了一套"agent"，但解决不同问题：
- **The Agent Company agent**（如 CEO）= system prompt 定义的 agent，有组织关系、预算、capabilities 字段
- **OpenClaw agent**（如 来财）= 文件系统定义的 agent，有 SOUL.md、MEMORY.md、skills、channels

当 The Agent Company agent 的 adapterType = "openclaw" 时，两层 agent 重叠，用户会搞不清 CEO 的 "capabilities" 和来财的 "SOUL.md" 哪个在起作用。

### 解决方案：统一为 Team Member

在新系统里，不再区分"The Agent Company agent"和"OpenClaw agent"。**Team Member（团队成员）= 一个完整的 AI 员工**，由四层构成：

```
Team Member
├─ 🪪 身份层 (Identity)
│  ├─ name: "来财"                    — 名字
│  ├─ soul: 性格/说话风格              — 对应 SOUL.md
│  ├─ avatar: 头像
│  └─ memory: 长期记忆                 — 对应 MEMORY.md + daily notes
│
├─ 🏢 组织层 (Organization)
│  ├─ role: "ceo"                     — 角色标识
│  ├─ title: "Chief Executive"        — 职位显示名
│  ├─ reportsTo: null                 — 汇报关系
│  ├─ budget: $50/month               — 月预算
│  └─ permissions: {...}              — 权限
│
├─ 🧩 能力层 (Capabilities)
│  ├─ jobDescription: "..."           — 工作职责（= The Agent Company capabilities）
│  ├─ skills: [...]                   — 技能列表（= OpenClaw skills）
│  ├─ channels: [telegram, slack...]  — 通信渠道（= OpenClaw channels）
│  └─ cron/heartbeat: [...]           — 定时任务
│
└─ ⚡ 引擎层 (Engine)
   ├─ provider: "anthropic"           — AI 供应商
   ├─ model: "claude-opus-4"          — 模型
   └─ adapterType: "openclaw" | "claude_local" | "codex_local" | ...
```

### 示例

| Team Member | 身份 | 组织 | 引擎 |
|---|---|---|---|
| 来财 | name="来财", soul=直率幽默 | role=CEO, budget=$50 | openclaw + claude-opus-4 |
| Coder-1 | name="Coder-1", soul=专注高效 | role=Engineer, reportsTo=CTO, budget=$30 | claude_local + claude-sonnet-4 |
| Writer | name="Writer", soul=创意文案 | role=Marketing, budget=$20 | codex_local + o3 |

### 引擎差异的透明处理

**用户不需要知道底层引擎类型的区别**，但系统内部需要处理：

| 引擎类型 | 身份层存储 | 记忆存储 | 能力层存储 |
|---|---|---|---|
| `openclaw` | 同步到 SOUL.md / IDENTITY.md | MEMORY.md + daily notes | OpenClaw skills/channels |
| `claude_local` 等 | The Agent Company DB | The Agent Company DB（agent sessions） | The Agent Company capabilities 字段 |
| `http` | The Agent Company DB | N/A | The Agent Company capabilities 字段 |

当引擎为 openclaw 时，编辑 Team Member 的 soul 字段 → 自动写入 SOUL.md；编辑 skills → 自动同步 OpenClaw skills 配置。

### UI 呈现

- **Team 页面**：看到的是统一的团队成员列表，每个成员显示名字、角色、状态、引擎标签
- **成员详情页**：四个 tab 对应四层（身份 / 组织 / 能力 / 引擎）
- **任务卡片**：显示 Team Member 头像 + 名字 + 角色标签
- **Org Chart**：标准组织架构图，节点就是 Team Member

---

## 三点五、工作流（Workflow / SOP）

### 问题

当前系统有"谁来做"（Team Member）和"做什么"（Task），但缺少"怎么做"。

具体地说：
- **Skills** 是单个能力（如"搜索网页"、"生成图片"），是原子操作
- **Task** 是一个目标（如"发布今天的公众号文章"），但不定义达成目标的步骤
- 真实工作往往需要**多个 skill + prompt + API/CLI/tool use 按特定顺序组合**，才能拿到稳定输出

### 解决方案：Workflow = 可复用的执行流程

**Workflow（工作流）** = 一组有序步骤的组合，每个步骤可以是：

```
Workflow: "每日公众号内容创作"
│
├─ Step 1: 选题调研
│  ├─ type: prompt
│  ├─ skill: web_search
│  └─ prompt: "搜索今日热点话题，筛选适合母婴领域的 3 个选题"
│
├─ Step 2: 文案撰写
│  ├─ type: prompt
│  ├─ skill: null（纯 LLM）
│  ├─ prompt: "基于选题 {{step1.output}}，撰写 800 字公众号文案"
│  └─ input: step1.output
│
├─ Step 3: 配图生成
│  ├─ type: skill
│  ├─ skill: openai-image-gen
│  └─ params: { prompt: "蜡笔画风格，{{step2.title}}", n: 5 }
│
├─ Step 4: 排版组装
│  ├─ type: api
│  ├─ endpoint: POST /api/wechat/draft
│  └─ body: { text: step2.output, images: step3.output }
│
└─ Step 5: 人工审核
   ├─ type: approval
   └─ prompt: "请审核内容，确认后自动发布"
```

### 步骤类型

| 类型 | 说明 | 示例 |
|---|---|---|
| `prompt` | LLM 生成，可选绑定 skill | 写文案、做分析、翻译 |
| `skill` | 调用 OpenClaw skill | 搜索、图片生成、TTS |
| `api` | 调用外部 HTTP API | 发布到公众号、推送通知 |
| `cli` | 执行命令行命令 | git 操作、脚本执行 |
| `tool_use` | 浏览器/工具操作 | 截图、表单填写 |
| `approval` | 等待人工审核 | 内容审核、发布确认 |
| `condition` | 条件分支 | if 阅读量 > 100 then ... |
| `loop` | 循环 | 对每个选题重复执行 |

### 步骤间数据流

- 每个步骤有 `input`（来自前序步骤的输出）和 `output`
- 支持模板引用：`{{step1.output}}`、`{{step2.title}}`
- 支持变量：workflow 级别的参数，执行时传入

### Workflow 与其他概念的关系

```
                    ┌─────────────┐
                    │  Workflow   │ ← 定义"怎么做"
                    │  (SOP)      │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  Task    │ │  Cron    │ │  Manual  │
        │ 任务触发  │ │ 定时触发  │ │ 手动触发  │
        └──────────┘ └──────────┘ └──────────┘
              │
              ▼
        ┌──────────┐
        │  Team    │ ← 由谁执行
        │  Member  │
        └──────────┘
```

- **Task 可以绑定 Workflow**：创建任务时选择"使用工作流 X"，Team Member 按工作流步骤执行
- **Cron 可以绑定 Workflow**：定时执行工作流（如每天早上跑内容创作流程）
- **手动触发**：用户在 UI 上点击"运行工作流"
- **Workflow 可以嵌套**：一个工作流的步骤可以引用另一个工作流

### Workflow 管理

- **创建/编辑**：UI 上的步骤编辑器（列表式，非拖拽画布）
- **版本管理**：每次修改生成新版本，可回滚
- **模板市场**：预制工作流模板（如"内容创作"、"竞品分析"、"客户跟进"）
- **执行历史**：每次运行记录所有步骤的输入输出、耗时、cost
- **调试模式**：逐步执行，可在任意步骤暂停查看中间结果

### 数据库

```
-- 新增表
workflows             — 工作流定义
workflow_versions      — 工作流版本（每次编辑新建版本）
workflow_steps         — 步骤定义（有序）
workflow_runs          — 执行记录
workflow_step_runs     — 每个步骤的执行记录（input/output/cost/duration）
workflow_templates     — 预制模板
```

### API

```
GET/POST /api/workflows                    — 列表 / 创建工作流
GET/PUT  /api/workflows/:id                — 查看 / 编辑工作流
POST     /api/workflows/:id/run            — 手动触发执行
GET      /api/workflows/:id/runs           — 执行历史
GET      /api/workflows/:id/runs/:runId    — 单次执行详情
POST     /api/workflows/:id/duplicate      — 复制工作流
GET      /api/workflow-templates           — 模板市场
POST     /api/workflow-templates/:id/import — 导入模板
```

---

## 四、页面结构设计

### 导航（左侧栏）

```
📊 Overview          — 总览仪表盘（来自 Control Center 概念）
📋 Projects          — 项目列表
  └─ [项目名]
     ├─ 📌 Board     — Kanban 看板（来自 Vibe-Kanban）
     ├─ 📝 Tasks     — 任务列表/详情
     ├─ 🎯 Goals     — 目标对齐树
     └─ 📊 Reports   — 项目报告
👥 Team              — 团队管理
  ├─ 👤 Members      — 团队成员列表（统一模型）
  └─ 🏗️ Org Chart    — 组织架构图
🔄 Workflows         — 工作流管理
💰 Usage & Budget    — 用量 + 预算（合并）
📂 Documents         — 文档工作台（来自 Control Center）
🧠 Memory            — Memory 管理（来自 Control Center）
🔗 Collaboration     — Agent 间协作可视化（来自 Control Center）
⚙️ Settings
  ├─ 🤖 Models       — AI 模型配置（来自 ClawX）
  ├─ 📡 Channels     — 通信渠道（来自 ClawX）
  ├─ 🧩 Skills       — 技能管理（来自 ClawX）
  ├─ ⏰ Cron & Heartbeat — 定时任务（来自 ClawX + The Agent Company）
  ├─ 🎨 Branding     — 品牌设置（新增）
  ├─ 🌐 Language     — 语言切换
  └─ 🔒 Security     — 安全设置（来自 Control Center）
```

---

## 五、技术方案

### 5.1 基座：The Agent Company monorepo

保留 The Agent Company 的：
- Node.js API server + 嵌入式 PostgreSQL
- React 19 + Vite + Tailwind + Radix UI
- pnpm workspace monorepo 结构
- 所有现有 API 和数据模型

### 5.2 新增模块

| 模块 | 来源 | 集成方式 |
|---|---|---|
| Kanban 视图 | Vibe-Kanban | 提取 dnd-kit kanban 组件，适配 The Agent Company ticket 数据模型。不引入 Rust backend。 |
| OpenClaw 数据采集 | Control Center | 移植 `src/runtime` 数据读取逻辑（读 openclaw.json、gateway API、memory 文件），封装为 TAC API routes |
| 配置管理 UI | ClawX | 提取 Models/Channels/Skills/Cron 的 React 组件，去掉 Electron 依赖，适配 Web |
| i18n | ClawX + Vibe-Kanban | 采用 i18next + react-i18next，初始语言包：en + zh |
| 主题系统 | The Agent Company + ClawX | The Agent Company 的 Tailwind 设计 token 为准，加入 CSS 变量切换 light/dark |
| Branding | 新建 | 配置文件控制 app name、logo、primary color；渲染时动态替换 |

### 5.3 数据库扩展

在 The Agent Company 的 PostgreSQL 中新增表：

```
-- 扩展 The Agent Company 现有 agents 表，新增字段：
agents.soul           — 人格描述（对应 SOUL.md）
agents.identity_meta  — 身份元数据（对应 IDENTITY.md）
agents.engine_type    — 引擎类型标识（openclaw / claude_local / ...）

-- 新增表：
member_memory         — 非 openclaw 引擎的记忆存储
usage_records         — token 用量 + 费用记录（补充 The Agent Company cost_events）
memory_entries        — openclaw memory 文件索引（缓存）
document_entries      — 文档索引
collaboration_events  — agent 间通信事件
branding_config       — 品牌配置
```

### 5.4 API 扩展

新增 API routes（全部挂在 TAC server）：

```
-- 团队成员统一 API（扩展 The Agent Company 现有 agents API）
GET/PUT  /api/agents/:id/identity      — 身份层（soul、avatar、name）
GET/PUT  /api/agents/:id/capabilities  — 能力层（skills、channels、job desc）
GET/PUT  /api/agents/:id/engine        — 引擎层（model、provider、adapter）
GET      /api/agents/:id/memory        — 记忆（openclaw 读文件 / 其他读 DB）

-- OpenClaw 平台级配置
GET/PUT  /api/openclaw/config          — 读写 openclaw.json
GET      /api/openclaw/usage           — 用量数据
GET      /api/openclaw/health          — 健康状态
GET/PUT  /api/openclaw/models          — 全局模型配置
GET/PUT  /api/openclaw/channels        — 全局渠道配置
GET/PUT  /api/openclaw/skills          — 全局技能管理
GET/PUT  /api/openclaw/cron            — 定时任务
GET/PUT  /api/openclaw/documents       — 文档读写
GET      /api/openclaw/collaboration   — 协作事件

-- 品牌
GET/PUT  /api/branding                 — 品牌配置
```

---

## 六、执行阶段

> **工期说明**：以 AI agent（coding agent）24h 连续工作能力估算，瓶颈在人工审核和调试周期。
> 每个 Phase 标注 agent 净工作时间 + 预估含审核的日历时间。

### Phase 1: 基础搭建（agent ~4-6h | 日历 ~1 天）
1. Fork The Agent Company，建立新仓库
2. 搭建 i18n 框架（i18next），提取所有硬编码字符串
3. 实现 light/dark mode 主题切换
4. 实现 branding 配置（app name、logo、primary color）
5. 创建新的导航结构

### Phase 2: Kanban 看板（agent ~3-4h | 日历 ~1 天）
1. 从 Vibe-Kanban 提取 kanban 组件（dnd-kit 拖拽逻辑）
2. 适配 The Agent Company ticket 数据模型（status → kanban column 映射）
3. Board 视图集成到 Project 页面
4. 支持拖拽改变任务状态

### Phase 3: OpenClaw 可观测性（agent ~6-8h | 日历 ~1.5 天）
1. 移植 Control Center 的数据采集逻辑
2. 实现 Overview 仪表盘（健康状态、活跃 agent、待审批、风险指标）
3. 实现 Usage & Budget 合并页面
4. 实现 Memory 管理页面
5. 实现 Documents 工作台
6. 实现 Collaboration 可视化

### Phase 4: OpenClaw 配置管理（agent ~4-6h | 日历 ~1 天）
1. 从 ClawX 提取配置管理组件（去 Electron 化）
2. 实现 Models 配置页面
3. 实现 Channels 配置页面
4. 实现 Skills 管理页面
5. 实现 Cron & Heartbeat 配置页面
6. 实现统一 Team Member 编辑页（身份/组织/能力/引擎四层 tab）
7. 实现 openclaw 引擎的双向同步（SOUL.md ↔ soul 字段，skills ↔ capabilities）

### Phase 5: 工作流系统（agent ~6-8h | 日历 ~1.5 天）
1. 设计 workflow/step 数据模型和 DB schema
2. 实现工作流编辑器（步骤列表 + 步骤类型配置）
3. 实现工作流执行引擎（按步骤顺序执行，步骤间数据传递）
4. 实现 approval 步骤（暂停等待人工审核）
5. 实现 condition/loop 控制流
6. 绑定 Task 和 Cron（任务/定时可选择工作流）
7. 执行历史和调试模式

### Phase 6: 团队协作增强（agent ~4-6h | 日历 ~1 天）
1. Agent 间消息系统（直接对话，不只是任务委派）
2. 自动日报/站会（每日自动汇总每个成员的工作进展）
3. Peer Review 机制（成员 A 的产出交给成员 B 审核后才算完成）
4. 升级协议（明确的规则：什么情况下 escalate 给上级 / 人类）
5. 通知中心（人类视角：什么事情需要我关注）
6. 绩效看板（成功率、产出质量、成本效率、响应速度）
7. 入职流程（新成员自动获取公司上下文、历史决策、SOP）
8. 反馈回路（人类给 agent 反馈 → 自动更新 soul/capabilities/workflow）

### Phase 7: 打磨 & 测试（agent ~3-4h | 日历 ~1 天）
1. 全量 i18n 翻译（en + zh）
2. 主题一致性检查
3. 响应式布局适配（桌面 + 平板）
4. 端到端测试

> **总计**：agent 净工作 ~30-42h | 日历含审核 ~7-8 天

---

## 七、风险与决策点

### 7.1 集成风险

| 风险 | 影响 | 应对 |
|---|---|---|
| Vibe-Kanban 用 Rust backend，提取纯前端成本 | 中 | 只取 React 组件层，数据层用 TAC API |
| Control Center 是 server-rendered HTML，无 React 组件可复用 | 中 | 只移植数据逻辑和页面设计概念，UI 全部用 React 重写 |
| ClawX 组件绑定 Electron IPC | 中 | 替换 IPC 调用为 HTTP API 调用 |
| The Agent Company 的 theming 偏暗色，加 light mode 工作量 | 低 | CSS 变量方案，改动集中 |
| 四个项目的 Radix/Tailwind 版本不同 | 低 | 统一到 The Agent Company 的版本 |

### 7.2 工作流可靠性（超时、带宽、部分失败）

这是最大的系统性风险。工作流是链式的，真实场景下会遇到：

**问题拆解：**

| 问题 | 场景 | 后果 |
|---|---|---|
| 单步超时 | 一个复杂 prompt 跑了 10 分钟 | 该步骤挂了，后续步骤全部阻塞 |
| 链式雪崩 | Step 3 失败，Step 4/5 依赖 Step 3 输出 | 整条链断裂，半成品无法用也无法回滚 |
| 并发压力 | 5 个 agent 同时跑 5 个 workflow | OpenClaw Gateway 带宽打满，所有任务变慢或超时 |
| 部分成功困境 | 5 步完成了 3 步，第 4 步失败 | 前 3 步的产出已生成但不完整，回滚浪费，继续又走不通 |

**设计应对：**

#### a) 步骤级弹性

```
每个 workflow step 配置：
├─ timeout: 300s               — 单步超时（可按步骤类型默认值 + 自定义覆盖）
├─ retries: 2                  — 自动重试次数
├─ retryDelay: "exponential"   — 重试间隔策略
├─ fallback: "skip" | "fail" | "manual" | "alternative_step"
│  ├─ skip    → 跳过此步，用空输出继续
│  ├─ fail    → 标记工作流失败，保留已完成步骤的产出
│  ├─ manual  → 暂停工作流，通知人类介入
│  └─ alternative_step → 回退到备选步骤（如换一个 skill/model 再试）
└─ checkpoint: true            — 是否保存此步产出为检查点
```

#### b) 检查点和断点续跑

- 每个 `checkpoint: true` 的步骤完成后，将输出持久化
- 工作流失败后，可以从**最后一个检查点**恢复执行（resume），不需要从头开始
- UI 上显示：✅ Step 1 → ✅ Step 2 → ✅ Step 3（checkpoint）→ ❌ Step 4 → ⏸️ Step 5
- 用户可以选择：**从 Step 4 重试** / **手动填入 Step 4 输出并继续** / **放弃**

#### c) 并发控制

```
系统级配置：
├─ max_concurrent_workflows: 3      — 同时执行的工作流上限
├─ max_concurrent_steps: 5          — 同时执行的步骤上限（跨所有工作流）
├─ queue_strategy: "fifo"           — 超出上限时排队
└─ priority: workflow 可设优先级

Agent 级配置：
├─ max_concurrent_runs: 1           — 单个 agent 同时执行的工作流上限
└─ cooldown_between_runs: 30s       — 两次执行间的冷却时间
```

- 当并发超限时，新工作流进入队列等待，而不是直接超时
- 实时显示队列状态：`排队中 (第 2 位) → 预计 3 分钟后开始`

#### d) 超时层次化

```
超时从小到大三层：
├─ step_timeout:     单步超时（默认 5 分钟，可配置）
├─ workflow_timeout:  整个工作流超时（默认 60 分钟，可配置）
└─ system_timeout:    系统级熔断（gateway 连接超时、心跳丢失检测）
```

- 工作流超时不是简单掐断，而是先通知 → 等待 → 强制终止
- 系统级熔断：如果 Gateway 连续 N 次无响应，暂停所有新工作流启动

#### e) 部分产出的处理策略

工作流失败后，前几步的产出不是废品，需要明确处理：

| 策略 | 说明 | 适用场景 |
|---|---|---|
| **保留 + 标记** | 产出保留在系统中，标记为"不完整" | 内容创作（前几步的文案/图片仍有价值） |
| **保留 + 人工完成** | 保留已完成部分，人工接手剩余步骤 | 审批流程（前面的调研结果仍可用） |
| **回滚** | 撤销所有外部副作用（API 调用、文件写入） | 发布流程（半发布比不发布更糟） |
| **重试整条链** | 从头开始重新执行 | 幂等操作（搜索、分析） |

每个 workflow 可配置默认的失败策略，每个 step 可覆盖。

### 7.3 安全性

#### a) 权限体系

```
权限分三层：
├─ 🏢 公司级
│  ├─ 谁能创建/删除 Team Member
│  ├─ 谁能查看/修改预算
│  └─ 谁能访问系统设置
│
├─ 👤 成员级
│  ├─ 能访问哪些项目
│  ├─ 能执行哪些 workflow
│  ├─ 能调用哪些 skill
│  ├─ 能读写哪些文件/目录
│  └─ 预算限额
│
└─ 📋 任务级
   ├─ 哪些任务需要人工审批
   ├─ 外部 API 调用是否需要确认
   └─ 文件删除/覆盖是否需要确认
```

#### b) 数据隔离

| 边界 | 策略 |
|---|---|
| 公司间 | 完全隔离（The Agent Company 已有，继承） |
| 项目间 | 默认隔离，可配置共享 |
| 成员间 | Memory 默认私有，Documents 按项目共享 |
| 工作流执行间 | 每次执行独立 sandbox，不共享临时变量 |
| 人类用户 vs Agent | Agent 不能自行授予权限、不能修改安全配置 |

#### c) 敏感操作管控

```
操作分级：
├─ 🟢 自由执行  — 读文件、搜索、内部 LLM 调用
├─ 🟡 需记录    — 写文件、修改配置、agent 间通信
├─ 🔴 需审批    — 外部 API 调用、发邮件/消息、删除数据、修改权限
└─ ⛔ 禁止      — 修改安全策略、访问其他公司数据、自我提权
```

- 所有操作写入不可变审计日志（The Agent Company 已有 activity log，扩展）
- 敏感操作触发实时通知给 Board（人类管理者）
- 工作流中的外部 API 调用必须在 workflow 定义时声明，运行时不能动态添加

#### d) Secret 管理

- 继承 The Agent Company 的 secret 管理（本地加密，`pcp_secret:` 引用）
- 工作流步骤中的 API key / token 不直接写在步骤定义里，通过 secret 引用
- Agent 运行日志自动脱敏（The Agent Company 已有 redaction，继承）
- 不同 Team Member 可以有不同的 secret 访问范围

#### e) OpenClaw 特有安全考虑

| 风险 | 应对 |
|---|---|
| Agent 通过 SOUL.md 被注入恶意指令 | SOUL.md 修改需要 Board 审批或至少记录 + 通知 |
| Agent 通过 skill 获得超范围能力 | skill 安装/启用需要审批，运行时 sandbox |
| Agent 间通信传播恶意指令 | agent 间消息经过内容审查，不执行来自其他 agent 的系统指令 |
| Channel 暴露内部数据 | 外发消息（Telegram、email 等）默认需要审批，可按 channel 放宽 |
| 工作流绕过权限 | 工作流的每一步在执行时以绑定 Team Member 的权限运行，不继承 workflow 创建者权限 |

---

## 八、最终产品定位

**一句话**：让非技术用户搭建自己的 AI 工作流。

- **工作流是第一公民** — 用 skill 组合搭建可复用的业务管线
- **过程透明是杀手级差异化** — L3 步骤卡片实时展示每步的状态、输入、产出
- **角色隐喻保留** — 用户看到"写手"、"主编"，底层是单 agent + 多 skill
- 不需要懂命令行，可视化搭建
- 5 个预制工作流模板：内容创作、广告策略、SEO 审计、竞品分析、客户跟进
- 多语言、可换品牌、light/dark 主题
- 完整的 OpenClaw 配置和监控，不用切到终端
