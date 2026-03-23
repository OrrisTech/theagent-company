# Plugin Authoring Smoke Example

A TAC plugin

## Development

```bash
pnpm install
pnpm dev            # watch builds
pnpm dev:ui         # local dev server with hot-reload events
pnpm test
```

## Install Into The Agent Company

```bash
pnpm theagentcompany plugin install ./
```

## Build Options

- `pnpm build` uses esbuild presets from `@theagentcompany/plugin-sdk/bundlers`.
- `pnpm build:rollup` uses rollup presets from the same SDK.
