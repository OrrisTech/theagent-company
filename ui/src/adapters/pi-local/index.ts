import type { UIAdapterModule } from "../types";
import { parsePiStdoutLine } from "@theagentcompany/adapter-pi-local/ui";
import { PiLocalConfigFields } from "./config-fields";
import { buildPiLocalConfig } from "@theagentcompany/adapter-pi-local/ui";

export const piLocalUIAdapter: UIAdapterModule = {
  type: "pi_local",
  label: "Pi (local)",
  parseStdoutLine: parsePiStdoutLine,
  ConfigFields: PiLocalConfigFields,
  buildAdapterConfig: buildPiLocalConfig,
};
