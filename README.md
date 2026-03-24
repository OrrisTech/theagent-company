<p align="center">
  <img src="doc/assets/header.png" alt="The Agent Company" width="720" />
</p>

<p align="center">
  <strong>AI agent orchestration platform</strong> — manage, monitor, and deploy AI agent teams from a single control plane.
</p>

<p align="center">
  <a href="#quick-start"><strong>Quick Start</strong></a> &middot;
  <a href="#features"><strong>Features</strong></a> &middot;
  <a href="doc/DOCKER.md"><strong>Docker</strong></a> &middot;
  <a href="https://discord.gg/m4HZY7xNG3"><strong>Discord</strong></a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
  <a href="https://github.com/OrrisTech/theagent-company/stargazers"><img src="https://img.shields.io/github/stars/OrrisTech/theagent-company?style=flat" alt="Stars" /></a>
  <a href="https://discord.gg/m4HZY7xNG3"><img src="https://img.shields.io/discord/000000000?label=discord" alt="Discord" /></a>
</p>

<br/>

## Features

- **Multi-agent orchestration** with real-time monitoring and org charts
- **Multiple execution engines**: Claude Code, Codex, Gemini CLI, OpenCode, OpenAI API, Anthropic API, OpenClaw Gateway
- **Workflow engine** with visual editor (7 step types)
- **Skills marketplace** and plugin system
- **Cost tracking** and budget management per agent
- **Dark/light themes** with 6 color schemes (Amber, Mono, Blue, Rose, Emerald, Arctic)
- **Full i18n** support (English + Chinese)
- **Mobile-ready** responsive UI

<br/>

## Quick Start

### Local (macOS/Linux)

```bash
git clone https://github.com/OrrisTech/theagent-company
cd theagent-company
pnpm install
pnpm build
pnpm dev
# Open http://localhost:3100
```

An embedded PostgreSQL database is created automatically — no external setup required.

> **Requirements:** Node.js 20+, pnpm 9.15+

### CLI (npx)

```bash
npx theagentcompany onboard --yes
```

The onboarding wizard detects your local CLIs (Claude, Codex, OpenCode, Pi), or lets you configure API keys or an OpenClaw Gateway.

### Docker (Cloud)

```bash
# Copy and configure
cp .env.example .env
# Edit .env — set BETTER_AUTH_SECRET and at least one API key

# Quickstart (embedded PostgreSQL — local only)
docker compose -f docker-compose.quickstart.yml up

# Production (external PostgreSQL)
docker compose up
```

<br/>

## Architecture

| Layer | Stack |
|-------|-------|
| **Server** | Node.js + Express + PostgreSQL (Drizzle ORM) |
| **UI** | React 19 + Vite + TailwindCSS + Radix UI |
| **CLI** | Node.js + Commander + esbuild |
| **Adapters** | Pluggable execution engines (local CLI, HTTP API, WebSocket) |

<br/>

## Documentation

- [Deployment Guide](doc/DOCKER.md)
- [Database Setup](doc/DATABASE.md)
- [Deployment Modes](doc/DEPLOYMENT-MODES.md)
- [CLI Reference](doc/CLI.md)
- [Development Guide](doc/DEVELOPING.md)
- [Plugin System](doc/plugins/)
- [Specifications](doc/spec/)

<br/>

## Development

```bash
pnpm dev              # Full dev (API + UI, watch mode)
pnpm dev:once         # Full dev without file watching
pnpm dev:server       # Server only
pnpm build            # Build all
pnpm typecheck        # Type checking
pnpm test:run         # Run tests
pnpm db:generate      # Generate DB migration
pnpm db:migrate       # Apply migrations
```

See [doc/DEVELOPING.md](doc/DEVELOPING.md) for the full development guide.

<br/>

## Contributing

We welcome contributions. See the [contributing guide](CONTRIBUTING.md) for details.

<br/>

## Community

- [Discord](https://discord.gg/m4HZY7xNG3) — Join the community
- [GitHub Issues](https://github.com/OrrisTech/theagent-company/issues) — bugs and feature requests
- [GitHub Discussions](https://github.com/OrrisTech/theagent-company/discussions) — ideas and RFC

<br/>

## License

MIT &copy; 2026 The Agent Company

<br/>

---

<p align="center">
  <sub>Open source under MIT. Built for people who want to run companies, not babysit agents.</sub>
</p>
