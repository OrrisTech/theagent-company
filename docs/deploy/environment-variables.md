---
title: Environment Variables
summary: Full environment variable reference
---

All environment variables that The Agent Company uses for server configuration.

## Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | Server port |
| `HOST` | `127.0.0.1` | Server host binding |
| `DATABASE_URL` | (embedded) | PostgreSQL connection string |
| `TAC_HOME` | `~/.theagentcompany` | Base directory for all TAC data |
| `TAC_INSTANCE_ID` | `default` | Instance identifier (for multiple local instances) |
| `TAC_DEPLOYMENT_MODE` | `local_trusted` | Runtime mode override |

## Secrets

| Variable | Default | Description |
|----------|---------|-------------|
| `TAC_SECRETS_MASTER_KEY` | (from file) | 32-byte encryption key (base64/hex/raw) |
| `TAC_SECRETS_MASTER_KEY_FILE` | `~/.theagentcompany/.../secrets/master.key` | Path to key file |
| `TAC_SECRETS_STRICT_MODE` | `false` | Require secret refs for sensitive env vars |

## Agent Runtime (Injected into agent processes)

These are set automatically by the server when invoking agents:

| Variable | Description |
|----------|-------------|
| `TAC_AGENT_ID` | Agent's unique ID |
| `TAC_COMPANY_ID` | Company ID |
| `TAC_API_URL` | TAC API base URL |
| `TAC_API_KEY` | Short-lived JWT for API auth |
| `TAC_RUN_ID` | Current heartbeat run ID |
| `TAC_TASK_ID` | Issue that triggered this wake |
| `TAC_WAKE_REASON` | Wake trigger reason |
| `TAC_WAKE_COMMENT_ID` | Comment that triggered this wake |
| `TAC_APPROVAL_ID` | Resolved approval ID |
| `TAC_APPROVAL_STATUS` | Approval decision |
| `TAC_LINKED_ISSUE_IDS` | Comma-separated linked issue IDs |

## LLM Provider Keys (for adapters)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key (for Claude Local adapter) |
| `OPENAI_API_KEY` | OpenAI API key (for Codex Local adapter) |
