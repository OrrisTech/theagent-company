import type { TacPluginManifestV1 } from "@theagentcompany/plugin-sdk";

const manifest: TacPluginManifestV1 = {
  id: "theagentcompany.plugin-authoring-smoke-example",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Plugin Authoring Smoke Example",
  description: "A TAC plugin",
  author: "Plugin Author",
  categories: ["connector"],
  capabilities: [
    "events.subscribe",
    "plugin.state.read",
    "plugin.state.write"
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui"
  },
  ui: {
    slots: [
      {
        type: "dashboardWidget",
        id: "health-widget",
        displayName: "Plugin Authoring Smoke Example Health",
        exportName: "DashboardWidget"
      }
    ]
  }
};

export default manifest;
