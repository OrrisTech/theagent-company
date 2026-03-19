#!/bin/bash
# Run remaining phases sequentially
# Each phase: run claude code → verify → commit → next
set -e

cd /Users/james/Dev/theagent-company

run_phase() {
  local phase_num=$1
  local phase_name=$2
  local prompt=$3
  
  echo "=========================================="
  echo "Starting Phase $phase_num: $phase_name"
  echo "=========================================="
  
  # Check if already done
  if git log --oneline | grep -q "Phase $phase_num"; then
    echo "Phase $phase_num already committed, skipping."
    return 0
  fi
  
  claude -p "$prompt" --allowedTools "Edit,Write,Bash,Read" --max-turns 200
  
  echo "Phase $phase_num code done, verifying..."
  pnpm build
  pnpm test:run
  pnpm typecheck
  
  # Commit if there are changes
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "feat: Phase $phase_num — $phase_name"
    echo "Phase $phase_num committed."
  else
    echo "Phase $phase_num: no changes to commit."
  fi
}

# Phase 5
run_phase 5 "Workflow System" "Read .claude/CLAUDE.md, docs/product/PRD.md, docs/product/integration-plan.md. Review docs/product/decision-logs/. Phases 1-4 are done. Implement Phase 5 — Workflow System:
1. Design workflow/step DB schema (workflows, workflow_versions, workflow_steps, workflow_runs, workflow_step_runs, workflow_templates tables)
2. Implement workflow editor UI — list-style step editor (not drag canvas). Each step configurable: type (prompt/skill/api/cli/tool_use/approval/condition/loop), input refs, timeout, retries, fallback, checkpoint.
3. Implement workflow execution engine — sequential step execution with data passing between steps via {{stepN.output}} templates.
4. Implement approval steps — pause workflow, notify user, wait for approval.
5. Implement condition/loop control flow.
6. Bind workflows to Tasks and Cron — task creation can select a workflow, cron can trigger workflow.
7. Execution history with step-by-step detail (input/output/cost/duration per step).
8. Debug mode — step-by-step execution with pause at any step.
9. Checkpoint + resume — failed workflows can resume from last checkpoint.
10. Concurrency control — system-level and agent-level limits.
All strings i18n (en+zh). Light/dark mode. Real tests. Decision log in docs/product/decision-logs/phase-5.md. Follow .claude/CLAUDE.md Definition of Done."

# Phase 6
run_phase 6 "Team Collaboration Enhancement" "Read .claude/CLAUDE.md, docs/product/PRD.md, docs/product/integration-plan.md. Review docs/product/decision-logs/. Phases 1-5 are done. Implement Phase 6 — Team Collaboration Enhancement:
1. Agent-to-agent messaging system — direct messages between team members, persistent and auditable.
2. Auto daily report / standup — auto-summarize each member's work progress daily (completed tasks, in-progress, blockers, plan).
3. Peer Review mechanism — member A's output goes to member B for review before completion. Review comments auto-feedback.
4. Escalation protocol — configurable rules for when to escalate to manager/human (budget exceeded, N retries failed, sensitive operation, agent uncertain).
5. Notification center — unified inbox for humans: approvals needed, workflow failures, budget warnings, escalations. Configurable notification channels.
6. Performance dashboard — task completion rate, workflow success rate, avg response time, cost efficiency, peer review pass rate, human edit rate.
7. Onboarding flow — new team member auto-receives company context, SOPs, team info, runs onboarding test task.
8. Feedback loop — human feedback on agent output → system suggests updates to soul/capabilities/workflow → human confirms → auto-apply.
All strings i18n (en+zh). Light/dark mode. Real tests. Decision log in docs/product/decision-logs/phase-6.md. Follow .claude/CLAUDE.md Definition of Done."

# Phase 7
run_phase 7 "Polish and Testing" "Read .claude/CLAUDE.md, docs/product/PRD.md, docs/product/integration-plan.md. Review docs/product/decision-logs/. Phases 1-6 are done. Implement Phase 7 — Polish & Testing:
1. Complete i18n translation audit — verify 100% of UI strings have both en and zh translations. Fix any missing keys.
2. Theme consistency check — verify all pages work correctly in light mode, dark mode, and system mode. Fix any styling issues.
3. Responsive layout — verify all pages work on desktop (1920px+) and tablet (768px+). Fix layout breaks.
4. E2E test suite — add end-to-end tests for critical user flows: create team member, create workflow, run workflow, kanban drag-drop, branding update.
5. Performance audit — check page load times, API response times, bundle size. Optimize where needed.
6. Accessibility audit — keyboard navigation, screen reader basics, color contrast.
7. Error handling audit — verify all API calls have proper error states, loading states, and user-friendly error messages.
8. Final verification: pnpm build && pnpm test:run && pnpm typecheck && pnpm lint — all zero errors.
Decision log in docs/product/decision-logs/phase-7.md. Follow .claude/CLAUDE.md Definition of Done."

echo "=========================================="
echo "ALL PHASES COMPLETE"
echo "=========================================="
git log --oneline -10
