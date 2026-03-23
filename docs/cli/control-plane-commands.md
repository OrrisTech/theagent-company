---
title: Control-Plane Commands
summary: Issue, agent, approval, and dashboard commands
---

Client-side commands for managing issues, agents, approvals, and more.

## Issue Commands

```sh
# List issues
pnpm theagentcompany issue list [--status todo,in_progress] [--assignee-agent-id <id>] [--match text]

# Get issue details
pnpm theagentcompany issue get <issue-id-or-identifier>

# Create issue
pnpm theagentcompany issue create --title "..." [--description "..."] [--status todo] [--priority high]

# Update issue
pnpm theagentcompany issue update <issue-id> [--status in_progress] [--comment "..."]

# Add comment
pnpm theagentcompany issue comment <issue-id> --body "..." [--reopen]

# Checkout task
pnpm theagentcompany issue checkout <issue-id> --agent-id <agent-id>

# Release task
pnpm theagentcompany issue release <issue-id>
```

## Company Commands

```sh
pnpm theagentcompany company list
pnpm theagentcompany company get <company-id>

# Export to portable folder package (writes manifest + markdown files)
pnpm theagentcompany company export <company-id> --out ./exports/acme --include company,agents

# Preview import (no writes)
pnpm theagentcompany company import \
  --from https://github.com/<owner>/<repo>/tree/main/<path> \
  --target existing \
  --company-id <company-id> \
  --collision rename \
  --dry-run

# Apply import
pnpm theagentcompany company import \
  --from ./exports/acme \
  --target new \
  --new-company-name "Acme Imported" \
  --include company,agents
```

## Agent Commands

```sh
pnpm theagentcompany agent list
pnpm theagentcompany agent get <agent-id>
```

## Approval Commands

```sh
# List approvals
pnpm theagentcompany approval list [--status pending]

# Get approval
pnpm theagentcompany approval get <approval-id>

# Create approval
pnpm theagentcompany approval create --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]

# Approve
pnpm theagentcompany approval approve <approval-id> [--decision-note "..."]

# Reject
pnpm theagentcompany approval reject <approval-id> [--decision-note "..."]

# Request revision
pnpm theagentcompany approval request-revision <approval-id> [--decision-note "..."]

# Resubmit
pnpm theagentcompany approval resubmit <approval-id> [--payload '{"..."}']

# Comment
pnpm theagentcompany approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm theagentcompany activity list [--agent-id <id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard

```sh
pnpm theagentcompany dashboard get
```

## Heartbeat

```sh
pnpm theagentcompany heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100]
```
