# HANDOFF.md — Session Continuity

## Current State (2026-03-23)

### What's Done
- Full UI/UX overhaul: login shader, 6 color schemes, sidebar redesign
- Agent → Member terminology unification (80+ i18n keys)
- Skills management: upload/CLI/ClawHub/delete (full stack)
- Workflow engine: 7 step types fully implemented
- i18n: ~230 keys, en + zh
- launchd daemon for dev server

### What's In Progress
- [ ] Production audit: silent `.catch(() => {})` cleanup
- [ ] Patrick Robinson follow-up

### Known Issues
- Tailscale :8443 can false-positive detectPort
- Delete `ui/dist` if you see minified React error #310

### Architecture Notes
- Four-layer model: Member → Role → Engine → Run
- Member detail page: 7 tabs (Overview/Identity/Organization/Capabilities/Engine/Runs/Costs)
- Login page uses Event Horizon WebGL shader

## How to Resume
1. `cd ~/Dev/theagent-company && pnpm dev`
2. Check git log for recent changes
3. Read this file + MEMORY.md for context
