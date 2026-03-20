# Phase 8 Plan — Agent Engineering Hardening

> 基于《你不知道的 Agent：原理、架构与工程实践》审核后的差距修补

## 差距总结

| 维度 | 差距 | 优先级 |
|---|---|---|
| Harness CI | DoD 停留在文档层面，没有 CI 执行 | 高 |
| 评测框架 | 没有最小评测闭环 | 高 |
| 上下文压缩 | Workflow 引擎没有 compact 策略 | 高 |
| Soul 注入 | Team Member 的 soul 字段没有分层加载机制 | 高 |
| Source-Sink 安全 | 没有 untrusted content 标注和 prompt injection 防护 | 中 |
| Provider Fallback | 没有多 provider 故障切换 | 中 |
| 工具描述 ACI | Skills 没有 Use when/Don't use when 格式 | 中 |
| 事件流追踪 | activity log 不是事件流架构 | 中 |
| 记忆自动整合 | Memory 页面只能查看，没有整合触发 | 中 |
| 多 Agent 协议 | Collaboration 没有 JSONL inbox 协议 | 中 |

## 实现范围（Phase 8）

聚焦高优先级 + 部分中优先级，可落地的改动：

### 8.1 Harness CI Pipeline
- GitHub Actions workflow: build → typecheck → test → lint
- 每次 push 和 PR 自动触发
- 失败阻止合并

### 8.2 最小评测框架
- `tests/eval/` 目录，收集真实失败案例转测试
- 评分器：代码评分器优先（结构匹配、断言验证）
- 能力评测 vs 回归测试分开
- `pnpm eval:run` 命令

### 8.3 Workflow 上下文压缩
- 工作流执行引擎加入 context budget 概念
- 步骤间数据传递时自动压缩大型输出
- 保留优先级配置（架构决策 > 验证状态 > 工具输出）
- checkpoint 存储完整数据，传递只存摘要

### 8.4 Soul 分层注入
- Team Member soul 字段 → 系统提示的 Identity 层
- jobDescription → Capabilities 层
- 不同引擎类型（openclaw vs claude_local）的注入路径不同
- openclaw 引擎：soul 双向同步到 SOUL.md

### 8.5 Source-Sink 安全隔离
- `wrapUntrustedContent(source, content)` 工具函数
- 所有外部数据（web_fetch、email、webhook）进入上下文时自动标注
- 敏感操作（外部 API、发消息、删除）需要显式确认
- 审计日志（append-only JSONL）

### 8.6 Provider Fallback
- 模型调用支持 provider 列表，按顺序尝试
- 503/429/timeout 自动切换下一个
- 切换事件记录到审计日志

### 8.7 Skills ACI 格式
- Skills 设置页面的描述显示改为 ACI 格式
- 模板：Use when / Don't use when / Output
- Skill 编辑器引导用户按此格式填写

### 8.8 事件流追踪
- Agent 执行时 emit tool_start/tool_end/turn_end 事件
- 事件存储为 append-only JSONL
- 事件 → activity log / UI 更新 / 评测框架（多路消费）
