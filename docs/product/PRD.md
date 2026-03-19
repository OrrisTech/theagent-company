# The Agent Company — Product Requirements Document

> Version: 1.0 Draft
> Date: 2026-03-19
> Author: James + 来财

---

## 1. Product Overview

### 1.1 Vision

**The Agent Company** (theagent.company) 是一个面向商业团队的 AI agent 管理平台。它将 AI agent 团队当作一家公司来管理——有组织架构、职位、预算、任务、工作流和绩效，让非技术用户也能轻松组建和运营 AI 团队。

### 1.2 One-Liner

**像管公司一样管 AI 团队。**

### 1.3 Target Users

| 用户类型 | 描述 | 核心需求 |
|---|---|---|
| **Business Operator** | 非技术背景的商业运营者 | 不需要命令行，可视化管理 AI 团队 |
| **Team Manager** | 管理多个 AI agent 的负责人 | 清晰的任务分配、进度跟踪、成本控制 |
| **Solo Founder** | 用 AI 团队运营公司的个人创业者 | 一个人管一整个 AI 公司，需要高效工具 |
| **Agency** | 为客户搭建 AI 团队的服务商 | 多公司隔离、品牌定制、可复制的模板 |

### 1.4 Base Projects

| Project | What We Use | What We Don't Use |
|---|---|---|
| **Paperclip** | 全部（server, DB, UI framework, agent model, governance） | — |
| **Vibe-Kanban** | Kanban 看板 UI 组件（dnd-kit） | Rust backend, workspace/terminal, git integration |
| **OpenClaw Control Center** | 数据采集逻辑, 页面概念设计 | server-rendered HTML（全部用 React 重写） |
| **ClawX** | 配置管理 UI, i18n framework, theme switching | Electron shell, desktop packaging |

---

## 2. Core Concepts

### 2.1 Team Member — 统一 Agent 模型

**核心设计决策**：不再区分 "Paperclip agent" 和 "OpenClaw agent"。

**Team Member = 一个完整的 AI 员工**，由四层构成：

#### 🪪 身份层 (Identity)

| 字段 | 说明 | 来源 |
|---|---|---|
| `name` | 名字（如"来财"） | 用户设置 |
| `soul` | 性格、说话风格、行为准则 | 对应 OpenClaw SOUL.md |
| `avatar` | 头像 | 用户上传 |
| `memory` | 长期记忆 | 对应 OpenClaw MEMORY.md + daily notes |

#### 🏢 组织层 (Organization)

| 字段 | 说明 | 来源 |
|---|---|---|
| `role` | 角色标识（ceo, engineer, marketing...） | Paperclip |
| `title` | 职位显示名 | Paperclip |
| `reportsTo` | 汇报关系 | Paperclip |
| `budget` | 月预算 | Paperclip |
| `permissions` | 权限集 | Paperclip |
| `status` | 状态（active, paused, terminated） | Paperclip |

#### 🧩 能力层 (Capabilities)

| 字段 | 说明 | 来源 |
|---|---|---|
| `jobDescription` | 工作职责描述 | Paperclip capabilities |
| `skills` | 技能列表 | OpenClaw skills |
| `channels` | 通信渠道（telegram, slack...） | OpenClaw channels |
| `cron` | 定时任务 | OpenClaw cron + Paperclip heartbeat |

#### ⚡ 引擎层 (Engine)

| 字段 | 说明 | 来源 |
|---|---|---|
| `adapterType` | 引擎类型 | Paperclip adapter |
| `provider` | AI 供应商 | 配置 |
| `model` | 模型 | 配置 |
| `adapterConfig` | 引擎详细配置 | Paperclip |

#### 引擎类型与存储映射

| 引擎类型 | 身份层存储 | 记忆存储 | 能力层存储 |
|---|---|---|---|
| `openclaw` | 同步到 SOUL.md / IDENTITY.md | MEMORY.md + daily notes | OpenClaw skills/channels |
| `claude_local` 等 | Paperclip DB | Paperclip DB（agent sessions） | Paperclip capabilities 字段 |
| `http` | Paperclip DB | N/A | Paperclip capabilities 字段 |

**关键原则**：用户在 UI 上看到的是一个统一的编辑界面，不需要知道底层存储差异。

---

### 2.2 Workflow — 工作流 / SOP

**Workflow = "怎么做"的可复用流程定义**

填补 Team Member（谁来做）和 Task（做什么）之间的空白。

#### 步骤类型

| 类型 | 说明 | 示例 |
|---|---|---|
| `prompt` | LLM 生成，可选绑定 skill | 写文案、做分析 |
| `skill` | 调用 OpenClaw skill | 图片生成、TTS |
| `api` | 调用外部 HTTP API | 发布到公众号 |
| `cli` | 执行命令行 | git 操作 |
| `tool_use` | 浏览器/工具操作 | 截图、表单 |
| `approval` | 等待人工审核 | 发布确认 |
| `condition` | 条件分支 | if/else |
| `loop` | 循环 | 对每个选题重复 |
| `workflow` | 嵌套工作流 | 引用另一个 workflow |

#### 触发方式

| 方式 | 说明 |
|---|---|
| Task 绑定 | 创建任务时选择"使用工作流 X" |
| Cron 定时 | 定时执行工作流 |
| 手动触发 | UI 上点击"运行" |
| Event 触发 | 特定事件发生时自动触发（未来扩展） |

#### 数据流

- 步骤间通过 `{{stepN.output}}` 模板引用传递数据
- Workflow 级别参数，执行时传入
- 每步有 input 和 output，全部持久化到执行记录

---

### 2.3 Project → Task → Subtask

继承 Paperclip 的 issue/ticket 模型，增强：

| 层级 | 说明 | 新增 |
|---|---|---|
| **Project** | 项目，有目标树（Goals） | Kanban Board 视图 |
| **Task** | 任务/Issue | 可绑定 Workflow |
| **Subtask** | 子任务 | 可由 Workflow 自动拆分 |

#### Kanban 看板

- 列 = 任务状态（To Do / In Progress / Review / Done）
- 卡片 = Task，显示 assignee（Team Member）、优先级、标签
- 拖拽改变状态
- 可自定义列

---

## 3. Feature Specifications

### 3.1 Overview Dashboard

**来源**: OpenClaw Control Center

| 模块 | 内容 |
|---|---|
| 健康状态 | Gateway 状态、活跃 agent 数、系统负载 |
| 待处理 | 需要审批的任务、需要人工介入的工作流 |
| 今日概览 | 完成任务数、消耗 token/费用、活跃项目 |
| 风险提醒 | 预算即将超限、agent 长时间无响应、工作流失败 |
| 团队状态 | 每个 Team Member 的当前状态和正在做的事 |

### 3.2 Team Management

#### Members 列表

| 显示信息 | 说明 |
|---|---|
| 头像 + 名字 | 来自身份层 |
| 角色 + 职位 | 来自组织层 |
| 状态 | active / busy / paused / terminated |
| 引擎标签 | 如 `openclaw · claude-opus-4` |
| 本月花费 / 预算 | 进度条 |
| 当前任务 | 正在做什么 |

#### Member 详情页

四个 Tab：
1. **身份 (Identity)** — 编辑名字、soul、头像、查看记忆
2. **组织 (Organization)** — 角色、职位、汇报关系、预算、权限
3. **能力 (Capabilities)** — 工作职责、技能列表、渠道、定时任务
4. **引擎 (Engine)** — 模型、供应商、adapter 配置

#### Org Chart

- 可视化组织架构图
- 节点 = Team Member（头像 + 名字 + 角色）
- 连线 = reportsTo 关系
- 支持拖拽调整汇报关系

### 3.3 Workflow Management

#### 工作流列表

| 显示信息 | 说明 |
|---|---|
| 名称 | 工作流名 |
| 步骤数 | 总步骤数 |
| 上次执行 | 时间 + 状态（成功/失败） |
| 执行次数 | 总计 |
| 绑定 | 绑定了哪些 Task / Cron |

#### 工作流编辑器

- **列表式步骤编辑器**（非拖拽画布，降低学习成本）
- 每个步骤可配置：
  - 类型（prompt/skill/api/cli/tool_use/approval/condition/loop）
  - 输入（引用前序步骤的输出）
  - 超时、重试、fallback 策略
  - checkpoint 标记
- 版本管理：每次保存生成新版本，可回滚
- 测试模式：逐步执行，可在任意步骤暂停

#### 执行视图

```
✅ Step 1: 选题调研 (3.2s, $0.02)
✅ Step 2: 文案撰写 (12.1s, $0.08)  [checkpoint]
✅ Step 3: 配图生成 (45.3s, $0.15)
❌ Step 4: 排版组装 (timeout after 300s)
⏸️ Step 5: 人工审核 (waiting)

[从 Step 4 重试] [手动填入 Step 4 输出] [放弃]
```

### 3.4 Usage & Budget

**来源**: Paperclip cost_events + OpenClaw Control Center usage

| 模块 | 内容 |
|---|---|
| 总览 | 本月总花费、vs 预算、趋势图 |
| 按成员 | 每个 Team Member 的花费明细 |
| 按项目 | 每个项目的花费 |
| 按工作流 | 每个工作流的平均成本 |
| Token 明细 | input/output tokens、模型分布 |
| 预警 | 即将超限的成员/项目 |

### 3.5 Documents & Memory

**来源**: OpenClaw Control Center

#### Documents

- 文档工作台：读写 workspace 中的 markdown 文件
- 按项目/成员分类
- 支持搜索
- 实时编辑（写回源文件）

#### Memory

- 查看每个 Team Member 的记忆
- OpenClaw 引擎：显示 MEMORY.md + daily notes（文件内容）
- 其他引擎：显示 DB 中的记忆记录
- Memory 健康状态（是否可搜索、文件是否存在）

### 3.6 Collaboration

**来源**: OpenClaw Control Center

- Agent 间消息可视化（谁发给谁、什么内容）
- Parent-child session 关系图
- 工作流中的协作步骤追踪
- 消息时间线

### 3.7 Team Collaboration Enhancement

#### Agent 间消息

- 不只是任务委派，支持直接对话（讨论、问问题、对齐）
- 消息记录持久化，可审计

#### 自动日报 / 站会

- 每日自动汇总每个成员的工作进展
- 汇总内容：完成任务、正在进行、遇到的问题、明日计划
- 可推送给人类管理者（通过 channel）

#### Peer Review

- 成员 A 的产出交给成员 B 审核后才算完成
- Review 意见自动反馈给原作者
- Review 通过后自动推进到下一步

#### 升级协议 (Escalation)

- 可配置规则：什么情况下 escalate 给上级 / 人类
  - 预算超限
  - 连续 N 次重试失败
  - 涉及敏感操作
  - Agent 不确定
- 升级链：Team Member → 上级 Team Member → Board（人类）

#### 通知中心

- 人类视角的统一通知入口
- 需要审批的事项
- 工作流失败告警
- 预算预警
- 成员求助/升级
- 可配置通知渠道（Web push、Telegram、Email）

#### 绩效看板

| 指标 | 说明 |
|---|---|
| 任务完成率 | 完成/总分配 |
| 成功率 | 工作流成功执行率 |
| 平均响应时间 | 从分配到开始执行 |
| 成本效率 | 产出/花费 |
| 质量分数 | peer review 通过率、人工修改率 |

#### 入职流程 (Onboarding)

- 新 Team Member 创建后，自动：
  - 获取公司目标和上下文
  - 阅读团队 SOP / 工作流
  - 了解其他成员和协作方式
  - 运行一个"入职测试"任务验证能力

#### 反馈回路

- 人类给 agent 反馈（"这里做得不好"）
- 系统自动分析反馈，建议更新：
  - soul（性格/说话风格需要调整）
  - capabilities（工作职责描述不够准确）
  - workflow（某个步骤的 prompt 需要优化）
- 人类确认后自动应用更新

---

## 4. Platform Settings

### 4.1 Models

**来源**: ClawX

- 查看/编辑 AI 模型配置
- Provider 管理（API key 通过 secret 引用，不明文显示）
- 默认模型设置
- 模型使用统计

### 4.2 Channels

**来源**: ClawX

- 查看/编辑通信渠道配置（Telegram, Slack, Discord, Email...）
- 每个渠道可绑定多个账号
- 渠道健康状态

### 4.3 Skills

**来源**: ClawX

- 技能列表（来自 OpenClaw skills 目录）
- 启用/禁用
- 安装新技能
- 技能详情（SKILL.md 内容）
- 每个技能的实际文件路径

### 4.4 Cron & Heartbeat

**来源**: ClawX + Paperclip

- 定时任务列表
- 创建/编辑/删除
- 可绑定 Workflow
- 执行历史
- 下次执行时间

### 4.5 Branding

**新增**

| 配置项 | 说明 |
|---|---|
| App Name | 替换 "The Agent Company" 为自定义名称 |
| Logo | 自定义 logo（侧栏、登录页） |
| Primary Color | 主色调 |
| Favicon | 浏览器标签图标 |

### 4.6 Language

- 支持语言：English, 中文
- i18n 框架：i18next + react-i18next
- 语言切换即时生效，不需要刷新

### 4.7 Theme

- Light Mode / Dark Mode / System Follow
- 以 Paperclip 的 Tailwind 设计 token 为基准
- CSS 变量驱动切换

### 4.8 Security

#### 权限三层

| 层级 | 控制内容 |
|---|---|
| 公司级 | 创建/删除 Team Member, 修改预算, 系统设置 |
| 成员级 | 项目访问, workflow 执行, skill 调用, 文件读写, 预算限额 |
| 任务级 | 人工审批门槛, 外部 API 确认, 文件删除确认 |

#### 操作分级

| 级别 | 操作 | 要求 |
|---|---|---|
| 🟢 自由 | 读文件、搜索、内部 LLM 调用 | 无 |
| 🟡 记录 | 写文件、修改配置、agent 间通信 | 写审计日志 |
| 🔴 审批 | 外部 API、发消息、删除数据、修改权限 | Board 审批 |
| ⛔ 禁止 | 修改安全策略、跨公司访问、自我提权 | 不可执行 |

#### 数据隔离

| 边界 | 策略 |
|---|---|
| 公司间 | 完全隔离 |
| 项目间 | 默认隔离，可配置共享 |
| 成员间 | Memory 私有，Documents 按项目共享 |
| 工作流执行间 | 独立 sandbox |

---

## 5. Workflow Reliability

### 5.1 Step-Level Resilience

每个步骤可配置：

| 配置 | 说明 | 默认值 |
|---|---|---|
| `timeout` | 单步超时 | 300s |
| `retries` | 自动重试次数 | 2 |
| `retryDelay` | 重试间隔策略 | exponential |
| `fallback` | 失败处理 | fail |
| `checkpoint` | 是否保存产出为检查点 | false |

Fallback 策略：
- `skip` — 跳过此步，用空输出继续
- `fail` — 标记工作流失败，保留已完成步骤产出
- `manual` — 暂停，通知人类介入
- `alternative_step` — 回退到备选步骤

### 5.2 Checkpoint & Resume

- `checkpoint: true` 的步骤完成后，输出持久化
- 失败后可从最后一个 checkpoint 恢复
- 支持手动填入失败步骤的输出并继续

### 5.3 Concurrency Control

| 级别 | 配置 | 默认值 |
|---|---|---|
| 系统级 | `max_concurrent_workflows` | 3 |
| 系统级 | `max_concurrent_steps` | 5 |
| Agent 级 | `max_concurrent_runs` | 1 |
| Agent 级 | `cooldown_between_runs` | 30s |

超限时排队，显示队列位置和预估等待时间。

### 5.4 Timeout Hierarchy

```
step_timeout (5 min) → workflow_timeout (60 min) → system_timeout (gateway 熔断)
```

### 5.5 Partial Output Handling

| 策略 | 适用场景 |
|---|---|
| 保留 + 标记 | 内容创作（半成品仍有价值） |
| 保留 + 人工完成 | 审批流程 |
| 回滚 | 发布流程（半发布比不发布更糟） |
| 重试整条链 | 幂等操作 |

---

## 6. Technical Architecture

### 6.1 Stack

| Layer | Technology |
|---|---|
| Backend | Node.js (Paperclip server) |
| Database | PostgreSQL (embedded or external) |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS + Radix UI |
| State | TanStack Query (server) + Zustand (client) |
| Build | Vite |
| i18n | i18next + react-i18next |
| Drag & Drop | dnd-kit |
| Testing | Vitest |

### 6.2 Monorepo Structure (extends Paperclip)

```
paperclip-plus/
├─ server/               — Paperclip server (extended)
│  ├─ src/
│  │  ├─ services/
│  │  │  ├─ agents.ts       — 扩展：身份层字段
│  │  │  ├─ workflows.ts    — 新增：工作流引擎
│  │  │  ├─ openclaw.ts     — 新增：OpenClaw 数据采集
│  │  │  └─ collaboration.ts — 新增：协作事件
│  │  └─ routes/
│  │     ├─ workflows.ts    — 工作流 API
│  │     ├─ openclaw.ts     — OpenClaw 配置 API
│  │     └─ branding.ts     — 品牌 API
│  └─ ...
├─ ui/                   — React UI (extended)
│  ├─ src/
│  │  ├─ pages/
│  │  │  ├─ overview/       — 总览仪表盘
│  │  │  ├─ team/           — 团队管理 + Org Chart
│  │  │  ├─ workflows/      — 工作流管理
│  │  │  ├─ documents/      — 文档工作台
│  │  │  ├─ memory/         — Memory 管理
│  │  │  ├─ collaboration/  — 协作可视化
│  │  │  └─ settings/       — 设置（models/channels/skills/cron/branding/security）
│  │  ├─ components/
│  │  │  ├─ kanban/         — Kanban 看板组件
│  │  │  ├─ workflow-editor/ — 工作流编辑器
│  │  │  └─ org-chart/      — 组织架构图
│  │  ├─ i18n/              — 翻译资源
│  │  │  ├─ en.json
│  │  │  └─ zh.json
│  │  └─ theme/             — 主题配置
│  └─ ...
├─ packages/             — Shared packages (from Paperclip)
├─ docs/                 — 文档
│  ├─ PRD.md             — 本文件
│  └─ integration-plan.md — 整合计划
└─ ...
```

### 6.3 Database Extensions

#### 扩展 agents 表

```sql
ALTER TABLE agents ADD COLUMN soul TEXT;
ALTER TABLE agents ADD COLUMN identity_meta JSONB;
ALTER TABLE agents ADD COLUMN engine_type TEXT;
```

#### 新增表

```sql
-- 工作流
CREATE TABLE workflows (...);
CREATE TABLE workflow_versions (...);
CREATE TABLE workflow_steps (...);
CREATE TABLE workflow_runs (...);
CREATE TABLE workflow_step_runs (...);
CREATE TABLE workflow_templates (...);

-- 协作
CREATE TABLE collaboration_events (...);
CREATE TABLE agent_messages (...);

-- 其他
CREATE TABLE member_memory (...);
CREATE TABLE memory_entries (...);
CREATE TABLE document_entries (...);
CREATE TABLE branding_config (...);
CREATE TABLE notifications (...);
CREATE TABLE escalation_rules (...);
CREATE TABLE peer_reviews (...);
CREATE TABLE daily_reports (...);
CREATE TABLE feedback_entries (...);
```

### 6.4 API Surface

#### Team Member API (extends Paperclip agents)

```
GET/PUT  /api/agents/:id/identity
GET/PUT  /api/agents/:id/capabilities
GET/PUT  /api/agents/:id/engine
GET      /api/agents/:id/memory
GET      /api/agents/:id/performance
```

#### Workflow API

```
GET/POST /api/workflows
GET/PUT  /api/workflows/:id
POST     /api/workflows/:id/run
GET      /api/workflows/:id/runs
GET      /api/workflows/:id/runs/:runId
POST     /api/workflows/:id/runs/:runId/resume
POST     /api/workflows/:id/duplicate
GET      /api/workflow-templates
POST     /api/workflow-templates/:id/import
```

#### Collaboration API

```
GET/POST /api/agents/:id/messages
GET      /api/collaboration/events
GET      /api/collaboration/topology
POST     /api/agents/:id/escalate
```

#### Notification API

```
GET      /api/notifications
PUT      /api/notifications/:id/read
GET      /api/notifications/settings
PUT      /api/notifications/settings
```

#### OpenClaw Platform API

```
GET/PUT  /api/openclaw/config
GET      /api/openclaw/usage
GET      /api/openclaw/health
GET/PUT  /api/openclaw/models
GET/PUT  /api/openclaw/channels
GET/PUT  /api/openclaw/skills
GET/PUT  /api/openclaw/cron
GET/PUT  /api/openclaw/documents
GET      /api/openclaw/collaboration
```

#### Branding API

```
GET/PUT  /api/branding
```

---

## 7. Execution Plan

> Agent 净工作时间 + 含人工审核的日历时间

| Phase | 内容 | Agent 时间 | 日历时间 |
|---|---|---|---|
| 1 | 基础搭建（i18n, 主题, branding, 导航） | 4-6h | ~1d |
| 2 | Kanban 看板 | 3-4h | ~1d |
| 3 | OpenClaw 可观测性（Overview, Usage, Memory, Docs, Collaboration） | 6-8h | ~1.5d |
| 4 | OpenClaw 配置管理 + 统一 Team Member 模型 | 4-6h | ~1d |
| 5 | 工作流系统（编辑器, 执行引擎, checkpoint, 调试） | 6-8h | ~1.5d |
| 6 | 团队协作增强（消息, 日报, peer review, 升级, 通知, 绩效, 入职, 反馈） | 4-6h | ~1d |
| 7 | 打磨 & 测试（i18n 翻译, 主题, 响应式, E2E 测试） | 3-4h | ~1d |
| **Total** | | **30-42h** | **~7-8d** |

---

## 8. Success Metrics

| 指标 | 目标 |
|---|---|
| 非技术用户能独立完成 onboarding | 首次使用不需要看文档 |
| 创建 Team Member 到执行第一个任务 | < 5 分钟 |
| 工作流成功率 | > 90%（含 retry） |
| 工作流部分失败恢复率 | > 80%（通过 checkpoint resume） |
| 页面加载时间 | < 2s |
| 中英文覆盖率 | 100% UI 字符串 |

---

## 9. Out of Scope (v1)

- Mobile app（v1 只做 responsive web）
- Clipmart 模板市场（Paperclip roadmap，v2 考虑）
- 多用户 auth（v1 沿用 Paperclip 的 local_trusted 模式）
- 视频/音频类 skill 的实时预览
- AI 自动生成工作流（v2 考虑，v1 手动创建）

### Skill 编写规范

所有 workflow template 和 skill 的编写，遵循 Anthropic 官方 skill 编写最佳实践。
详见 [Skill Writing Guide](skill-writing-guide.md)。

核心原则：
- Skill 是文件夹，不是 markdown 文件 — 包含脚本、资产、模板
- Description 是写给模型看的触发条件，不是摘要
- 利用文件系统做渐进式披露（progressive disclosure）
- Gotchas section 是信号密度最高的部分
- 避免 railroading — 给目标和约束，不给死板步骤
- 用 config.json 存储用户特定配置

---

## 10. Decisions (Resolved)

### 10.1 品牌名

**The Agent Company** ✅

- 域名：theagent.company
- 简称：TAC
- UI 显示：Agent Company
- Tagline："像管公司一样管 AI 团队"

### 10.2 开源策略

**Fork Paperclip 作为独立仓库**。不提 upstream PR，独立发展。

### 10.3 部署方式

**v1 只做本地部署**（`pnpm dev` / `pnpm paperclipai run`）。Docker 和云部署留 v2。

### 10.4 工作流模板

v1 提供 5 个预制模板：

#### Template 1: 内容创作流水线

> 参考：`~/Dev/writing-workflow/article-pipeline-skill`（去除品牌人设和本地路径等敏感信息）

```
Step 1: 选题分析
  type: prompt + skill(web_search)
  → 搜索热点 + 多学科框架分析 + 输出 3 个候选选题

Step 2: 内容创作
  type: prompt
  → 基于选题撰写文章（可配置风格、字数、受众）

Step 3: 自动审稿
  type: prompt (交叉验证)
  → 6 维度评分（信息密度、逻辑性、可读性、吸引力、原创性、实用性）
  → 低于阈值自动回到 Step 2 重写（loop，最多 3 轮）

Step 4: AI 味去除
  type: prompt
  → 去除 AI 生成内容的典型特征，让文章更自然

Step 5: 配图生成
  type: skill(openai-image-gen)
  → 封面图 + 章节插图

Step 6: 多平台排版
  type: prompt
  → 生成微信公众号 / 小红书 / X / LinkedIn 版本

Step 7: 人工审核
  type: approval
  → 确认后发布
```

#### Template 2: 广告策略生成

> 参考：`~/Dev/adwhiz-landing/src/lib/ads-strategy`（去除 API key 和 Supabase 配置）

```
Step 1: 网站分析
  type: prompt + skill(web_fetch)
  → 分析目标网站：商业模式、价值主张、目标受众、竞品

Step 2: 竞品调研
  type: prompt + skill(web_search)
  → 搜索竞品广告关键词、行业趋势、季节性因素

Step 3: Google Ads 策略
  type: prompt
  → 生成完整 Google Ads 方案：campaign 结构、关键词组、广告文案、预算分配、出价策略

Step 4: Meta Ads 策略
  type: prompt
  → 生成 Meta Ads 方案：受众定位、创意概念、版位策略、预算分配

Step 5: 跨平台整合
  type: prompt
  → Google/Meta 预算比例建议 + 落地页优化建议 + 90 天优化路线图

Step 6: 人工审核
  type: approval
  → 确认后可导出为实施文档
```

#### Template 3: SEO 审计

> 参考：安装的 `ai-seo`、`seo-audit`、`seo-geo`、`programmatic-seo` skills

```
Step 1: 技术 SEO 扫描
  type: skill(web_fetch) + prompt
  → 抓取目标站点，检查 meta tags、结构化数据、页面速度、移动端适配

Step 2: 内容 SEO 分析
  type: prompt + skill(web_search)
  → 关键词覆盖度、内容质量评分、竞品内容对比

Step 3: 地域 SEO 评估（可选）
  type: prompt
  → 本地化 SEO 状况、Google Business Profile、地域关键词

Step 4: Programmatic SEO 机会
  type: prompt
  → 识别可批量生成的页面模式（如 "/city/service" 组合）

Step 5: 综合报告
  type: prompt
  → 汇总所有发现，优先级排序，生成可执行的修复清单

Step 6: 人工审核
  type: approval
```

#### Template 4: 竞品分析

```
Step 1: 竞品识别
  type: prompt + skill(web_search)
  → 搜索直接竞品和间接竞品，生成竞品列表

Step 2: 产品对比
  type: prompt + skill(web_fetch)
  → 抓取各竞品网站，对比功能、定价、定位

Step 3: 市场定位分析
  type: prompt
  → 竞争格局图、差异化机会、威胁评估

Step 4: 策略建议
  type: prompt
  → 基于分析结果给出产品/营销/定价策略建议

Step 5: 人工审核
  type: approval
```

#### Template 5: 客户跟进

```
Step 1: 客户状态检查
  type: prompt + skill(himalaya 或 email skill)
  → 检查最近的客户邮件/消息，识别需要跟进的客户

Step 2: 跟进内容生成
  type: prompt
  → 根据客户阶段（cold/warm/hot/at-risk）生成个性化跟进内容

Step 3: 跟进方式选择
  type: condition
  → cold → 价值邮件 / warm → 进展询问 / hot → 促成邮件 / at-risk → 挽留邮件

Step 4: 人工审核
  type: approval
  → 确认后发送

Step 5: CRM 记录
  type: prompt
  → 更新客户状态和跟进记录
```

### 10.5 绩效评估指标

采用三类指标，从不同角度衡量 Team Member 表现：

#### a) 效率指标（系统自动采集）

| 指标 | 说明 | 计算方式 |
|---|---|---|
| **任务完成率** | 分配的任务有多少完成了 | 完成数 / 分配数 |
| **平均完成时间** | 从分配到完成的平均耗时 | 平均 (finishedAt - assignedAt) |
| **工作流成功率** | 工作流一次执行成功的比例 | 成功 runs / 总 runs |
| **单位成本** | 每完成一个任务花多少钱 | 总 cost / 完成任务数 |

#### b) 质量指标（交叉验证）

| 指标 | 说明 | 计算方式 |
|---|---|---|
| **Peer Review 通过率** | 产出被其他 agent 审核通过的比例 | 通过数 / 提交审核数 |
| **交叉验证一致性** | 用不同模型对同一产出评分的一致性 | 多模型评分标准差（越小越好） |
| **人工修改率** | 产出被人类修改后才使用的比例 | 被修改数 / 总产出数（越低越好） |
| **首次通过率** | 不需要返工就通过审核的比例 | 首次通过数 / 提交数 |

#### c) 协作指标（反映团队效能）

| 指标 | 说明 | 计算方式 |
|---|---|---|
| **响应速度** | 收到任务/消息后多快开始处理 | 平均 (startedAt - assignedAt) |
| **升级频率** | 多频繁需要升级给人类 | 升级次数 / 总任务数（适中为佳） |
| **反馈采纳率** | 收到反馈后是否改进了 | 改进后评分提升比例 |

**展示方式**：
- 每个 Team Member 详情页有"绩效"tab
- 团队级别有绩效排行榜
- 趋势图：展示指标随时间的变化
- 不用所有指标都在 v1 实现，先做效率指标 + 人工修改率 + 首次通过率
