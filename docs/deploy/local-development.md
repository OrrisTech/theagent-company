---
title: Local Development
summary: Set up The Agent Company for local development
---

Run The Agent Company locally with zero external dependencies.

## Prerequisites

- Node.js 20+
- pnpm 9+

## Start Dev Server

```sh
pnpm install
pnpm dev
```

This starts:

- **API server** at `http://localhost:3100`
- **UI** served by the API server in dev middleware mode (same origin)

No Docker or external database required. The Agent Company uses embedded PostgreSQL automatically.

## One-Command Bootstrap

For a first-time install:

```sh
pnpm theagentcompany run
```

This does:

1. Auto-onboards if config is missing
2. Runs `theagentcompany doctor` with repair enabled
3. Starts the server when checks pass

## Tailscale/Private Auth Dev Mode

To run in `authenticated/private` mode for network access:

```sh
pnpm dev --tailscale-auth
```

This binds the server to `0.0.0.0` for private-network access.

Alias:

```sh
pnpm dev --authenticated-private
```

Allow additional private hostnames:

```sh
pnpm theagentcompany allowed-hostname dotta-macbook-pro
```

For full setup and troubleshooting, see [Tailscale Private Access](/deploy/tailscale-private-access).

## Health Checks

```sh
curl http://localhost:3100/api/health
# -> {"status":"ok"}

curl http://localhost:3100/api/companies
# -> []
```

## Reset Dev Data

To wipe local data and start fresh:

```sh
rm -rf ~/.theagentcompany/instances/default/db
pnpm dev
```

## Data Locations

| Data | Path |
|------|------|
| Config | `~/.theagentcompany/instances/default/config.json` |
| Database | `~/.theagentcompany/instances/default/db` |
| Storage | `~/.theagentcompany/instances/default/data/storage` |
| Secrets key | `~/.theagentcompany/instances/default/secrets/master.key` |
| Logs | `~/.theagentcompany/instances/default/logs` |

Override with environment variables:

```sh
TAC_HOME=/custom/path TAC_INSTANCE_ID=dev pnpm theagentcompany run
```
