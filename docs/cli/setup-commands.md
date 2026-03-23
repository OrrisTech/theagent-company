---
title: Setup Commands
summary: Onboard, run, doctor, and configure
---

Instance setup and diagnostics commands.

## `theagentcompany run`

One-command bootstrap and start:

```sh
pnpm theagentcompany run
```

Does:

1. Auto-onboards if config is missing
2. Runs `theagentcompany doctor` with repair enabled
3. Starts the server when checks pass

Choose a specific instance:

```sh
pnpm theagentcompany run --instance dev
```

## `theagentcompany onboard`

Interactive first-time setup:

```sh
pnpm theagentcompany onboard
```

First prompt:

1. `Quickstart` (recommended): local defaults (embedded database, no LLM provider, local disk storage, default secrets)
2. `Advanced setup`: full interactive configuration

Start immediately after onboarding:

```sh
pnpm theagentcompany onboard --run
```

Non-interactive defaults + immediate start (opens browser on server listen):

```sh
pnpm theagentcompany onboard --yes
```

## `theagentcompany doctor`

Health checks with optional auto-repair:

```sh
pnpm theagentcompany doctor
pnpm theagentcompany doctor --repair
```

Validates:

- Server configuration
- Database connectivity
- Secrets adapter configuration
- Storage configuration
- Missing key files

## `theagentcompany configure`

Update configuration sections:

```sh
pnpm theagentcompany configure --section server
pnpm theagentcompany configure --section secrets
pnpm theagentcompany configure --section storage
```

## `theagentcompany env`

Show resolved environment configuration:

```sh
pnpm theagentcompany env
```

## `theagentcompany allowed-hostname`

Allow a private hostname for authenticated/private mode:

```sh
pnpm theagentcompany allowed-hostname my-tailscale-host
```

## Local Storage Paths

| Data | Default Path |
|------|-------------|
| Config | `~/.theagentcompany/instances/default/config.json` |
| Database | `~/.theagentcompany/instances/default/db` |
| Logs | `~/.theagentcompany/instances/default/logs` |
| Storage | `~/.theagentcompany/instances/default/data/storage` |
| Secrets key | `~/.theagentcompany/instances/default/secrets/master.key` |

Override with:

```sh
TAC_HOME=/custom/home TAC_INSTANCE_ID=dev pnpm theagentcompany run
```

Or pass `--data-dir` directly on any command:

```sh
pnpm theagentcompany run --data-dir ./tmp/theagentcompany-dev
pnpm theagentcompany doctor --data-dir ./tmp/theagentcompany-dev
```
