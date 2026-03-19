# Skill Writing Guide

> 基于 Anthropic 官方文章 "Lessons from Building Claude Code: How We Use Skills"
> 来源: https://x.com/trq212/status/2033949937936085378
> 适用于本项目的所有 workflow template 和 skill 编写

---

## 核心原则

**Skill 不是 markdown 文件，是文件夹。** 可以包含脚本、资产、数据、模板等，agent 可以发现、探索和操作。

---

## Skill 分类（9 类）

| 类型 | 说明 | 示例 |
|---|---|---|
| **Library & API Reference** | 解释如何正确使用库/CLI/SDK | billing-lib, frontend-design |
| **Product Verification** | 描述如何测试/验证代码正确性 | signup-flow-driver, checkout-verifier |
| **Data Fetching & Analysis** | 连接数据和监控 | funnel-query, grafana |
| **Business Process & Team Automation** | 自动化重复工作流 | standup-post, weekly-recap |
| **Code Scaffolding & Templates** | 生成框架样板代码 | new-migration, create-app |
| **Code Quality & Review** | 代码质量和审查 | adversarial-review, testing-practices |
| **CI/CD & Deployment** | 构建、推送、部署 | babysit-pr, deploy-service |
| **Runbooks** | 从症状到结构化报告的排查 | oncall-runner, log-correlator |
| **Infrastructure Operations** | 运维和维护 | dependency-management, cost-investigation |

---

## 编写最佳实践

### 1. Don't State the Obvious
Claude 对代码已经很懂了。Skill 应该关注**推动 Claude 偏离其默认思维模式**的信息。

### 2. Build a Gotchas Section
**Gotchas 是 skill 中信号密度最高的部分。** 记录 Claude 使用 skill 时常见的失败点。持续迭代更新。

### 3. Use the File System & Progressive Disclosure
把整个文件系统当作上下文工程和渐进式披露的手段：
- 把详细 API 签名拆到 `references/api.md`
- 把输出模板放到 `assets/` 
- 在 SKILL.md 中告诉 Claude 有哪些文件，它会在合适的时候读取

### 4. Avoid Railroading Claude
给 Claude 需要的信息，但给它灵活性去适应具体情况。不要过度具体化指令。

### 5. Think through the Setup
需要用户上下文的 skill，用 `config.json` 存储设置信息。如果配置未设置，agent 会向用户询问。

### 6. The Description Field Is For the Model
Description 不是摘要，是**触发条件**。Claude 在会话开始时扫描所有 skill 的 description 来决定是否使用。
- 用第三人称（"Use this skill when..."）
- 包含具体的触发关键词
- 保持 2-3 句以内

### 7. Memory & Storing Data
Skill 可以通过在内部存储数据来实现记忆：
- 简单：append-only 文本日志或 JSON 文件
- 复杂：SQLite 数据库
- 数据存在 `${CLAUDE_PLUGIN_DATA}` 稳定目录，避免升级时丢失

### 8. Store Scripts & Generate Code
**给 Claude 代码是最强大的工具之一。** 提供脚本和库让 Claude 专注于组合和决策，而不是重建样板。

### 9. On Demand Hooks
Skill 可以包含只在被调用时激活的 hooks：
- `/careful` — 阻止危险命令（rm -rf, DROP TABLE, force-push）
- `/freeze` — 阻止特定目录外的编辑

---

## 分发策略

| 方式 | 适用场景 |
|---|---|
| 检入仓库 `.claude/skills/` | 小团队、少量仓库 |
| Plugin marketplace | 大规模团队，让用户自选安装 |

### 质量控制
- 先在 sandbox 文件夹试用
- 获得足够 traction 后再正式发布
- **坏的或冗余的 skill 很容易产生，发布前需要 curation**

### 衡量
- 用 PreToolUse hook 记录 skill 使用情况
- 找到热门 skill 和触发不足的 skill

---

## 对本项目 Workflow Template 的指导

编写 workflow template 中的每个步骤时，遵循以上原则：

1. **每个步骤的 prompt 要避免 railroading** — 给目标和约束，不给死板的步骤
2. **包含 gotchas** — 每个模板都应该有"常见失败点"部分
3. **利用文件系统** — 模板可以包含参考文件、脚本、输出模板
4. **description 写给模型看** — workflow 的触发描述要用模型能理解的方式
5. **支持 config** — 用户特定的变量（品牌名、渠道、风格偏好）通过 config 注入
