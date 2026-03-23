# CLI Reference

TAC CLI now supports both:

- instance setup/diagnostics (`onboard`, `doctor`, `configure`, `env`, `allowed-hostname`)
- control-plane client operations (issues, approvals, agents, activity, dashboard)

## Base Usage

Use repo script in development:

```sh
pnpm theagentcompany --help
```

First-time local bootstrap + run:

```sh
pnpm theagentcompany run
```

Choose local instance:

```sh
pnpm theagentcompany run --instance dev
```

## Deployment Modes

Mode taxonomy and design intent are documented in `doc/DEPLOYMENT-MODES.md`.

Current CLI behavior:

- `theagentcompany onboard` and `theagentcompany configure --section server` set deployment mode in config
- runtime can override mode with `TAC_DEPLOYMENT_MODE`
- `theagentcompany run` and `theagentcompany doctor` do not yet expose a direct `--mode` flag

Target behavior (planned) is documented in `doc/DEPLOYMENT-MODES.md` section 5.

Allow an authenticated/private hostname (for example custom Tailscale DNS):

```sh
pnpm theagentcompany allowed-hostname dotta-macbook-pro
```

All client commands support:

- `--data-dir <path>`
- `--api-base <url>`
- `--api-key <token>`
- `--context <path>`
- `--profile <name>`
- `--json`

Company-scoped commands also support `--company-id <id>`.

Use `--data-dir` on any CLI command to isolate all default local state (config/context/db/logs/storage/secrets) away from `~/.theagentcompany`:

```sh
pnpm theagentcompany run --data-dir ./tmp/theagentcompany-dev
pnpm theagentcompany issue list --data-dir ./tmp/theagentcompany-dev
```

## Context Profiles

Store local defaults in `~/.theagentcompany/context.json`:

```sh
pnpm theagentcompany context set --api-base http://localhost:3100 --company-id <company-id>
pnpm theagentcompany context show
pnpm theagentcompany context list
pnpm theagentcompany context use default
```

To avoid storing secrets in context, set `apiKeyEnvVarName` and keep the key in env:

```sh
pnpm theagentcompany context set --api-key-env-var-name TAC_API_KEY
export TAC_API_KEY=...
```

## Company Commands

```sh
pnpm theagentcompany company list
pnpm theagentcompany company get <company-id>
pnpm theagentcompany company delete <company-id-or-prefix> --yes --confirm <same-id-or-prefix>
```

Examples:

```sh
pnpm theagentcompany company delete PAP --yes --confirm PAP
pnpm theagentcompany company delete 5cbe79ee-acb3-4597-896e-7662742593cd --yes --confirm 5cbe79ee-acb3-4597-896e-7662742593cd
```

Notes:

- Deletion is server-gated by `TAC_ENABLE_COMPANY_DELETION`.
- With agent authentication, company deletion is company-scoped. Use the current company ID/prefix (for example via `--company-id` or `TAC_COMPANY_ID`), not another company.

## Issue Commands

```sh
pnpm theagentcompany issue list --company-id <company-id> [--status todo,in_progress] [--assignee-agent-id <agent-id>] [--match text]
pnpm theagentcompany issue get <issue-id-or-identifier>
pnpm theagentcompany issue create --company-id <company-id> --title "..." [--description "..."] [--status todo] [--priority high]
pnpm theagentcompany issue update <issue-id> [--status in_progress] [--comment "..."]
pnpm theagentcompany issue comment <issue-id> --body "..." [--reopen]
pnpm theagentcompany issue checkout <issue-id> --agent-id <agent-id> [--expected-statuses todo,backlog,blocked]
pnpm theagentcompany issue release <issue-id>
```

## Agent Commands

```sh
pnpm theagentcompany agent list --company-id <company-id>
pnpm theagentcompany agent get <agent-id>
pnpm theagentcompany agent local-cli <agent-id-or-shortname> --company-id <company-id>
```

`agent local-cli` is the quickest way to run local Claude/Codex manually as a TAC agent:

- creates a new long-lived agent API key
- installs missing The Agent Company skills into `~/.codex/skills` and `~/.claude/skills`
- prints `export ...` lines for `TAC_API_URL`, `TAC_COMPANY_ID`, `TAC_AGENT_ID`, and `TAC_API_KEY`

Example for shortname-based local setup:

```sh
pnpm theagentcompany agent local-cli codexcoder --company-id <company-id>
pnpm theagentcompany agent local-cli claudecoder --company-id <company-id>
```

## Approval Commands

```sh
pnpm theagentcompany approval list --company-id <company-id> [--status pending]
pnpm theagentcompany approval get <approval-id>
pnpm theagentcompany approval create --company-id <company-id> --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]
pnpm theagentcompany approval approve <approval-id> [--decision-note "..."]
pnpm theagentcompany approval reject <approval-id> [--decision-note "..."]
pnpm theagentcompany approval request-revision <approval-id> [--decision-note "..."]
pnpm theagentcompany approval resubmit <approval-id> [--payload '{"...":"..."}']
pnpm theagentcompany approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm theagentcompany activity list --company-id <company-id> [--agent-id <agent-id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard Commands

```sh
pnpm theagentcompany dashboard get --company-id <company-id>
```

## Heartbeat Command

`heartbeat run` now also supports context/api-key options and uses the shared client stack:

```sh
pnpm theagentcompany heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100] [--api-key <token>]
```

## Local Storage Defaults

Default local instance root is `~/.theagentcompany/instances/default`:

- config: `~/.theagentcompany/instances/default/config.json`
- embedded db: `~/.theagentcompany/instances/default/db`
- logs: `~/.theagentcompany/instances/default/logs`
- storage: `~/.theagentcompany/instances/default/data/storage`
- secrets key: `~/.theagentcompany/instances/default/secrets/master.key`

Override base home or instance with env vars:

```sh
TAC_HOME=/custom/home TAC_INSTANCE_ID=dev pnpm theagentcompany run
```

## Storage Configuration

Configure storage provider and settings:

```sh
pnpm theagentcompany configure --section storage
```

Supported providers:

- `local_disk` (default; local single-user installs)
- `s3` (S3-compatible object storage)
