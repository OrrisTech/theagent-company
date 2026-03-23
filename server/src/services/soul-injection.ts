import type { SoulInjectionInput, SoulInjectionResult, SystemPromptLayers } from "@theagentcompany/shared";
import { logger } from "../middleware/logger.js";

const log = logger.child({ module: "soul-injection" });

/**
 * Build a layered system prompt from Team Member configuration.
 *
 * The prompt is composed of three layers:
 * 1. Identity — who the agent is (name, personality, behavioral guidelines)
 * 2. Capabilities — what the agent can do (job description, skills, tools)
 * 3. Context — situational information (current task, memory, workflow state)
 *
 * Different engine types (openclaw vs claude_local) may use different
 * formatting or injection methods, but the layer structure is consistent.
 */
export function buildSystemPrompt(input: SoulInjectionInput): SoulInjectionResult {
  log.debug({ name: input.name, engineType: input.engineType }, "Building system prompt");

  const layers = buildLayers(input);
  const systemPrompt = assembleLayers(layers, input.engineType);

  return { systemPrompt, layers };
}

/**
 * Build individual prompt layers from Team Member data.
 */
function buildLayers(input: SoulInjectionInput): SystemPromptLayers {
  // --- Identity Layer ---
  const identityParts: string[] = [];
  identityParts.push(`You are ${input.name}.`);

  if (input.soul) {
    identityParts.push("");
    identityParts.push("## Personality & Guidelines");
    identityParts.push(input.soul);
  }

  const identity = identityParts.join("\n");

  // --- Capabilities Layer ---
  const capParts: string[] = [];

  if (input.jobDescription) {
    capParts.push("## Job Description");
    capParts.push(input.jobDescription);
  }

  if (input.skills && input.skills.length > 0) {
    capParts.push("");
    capParts.push("## Available Skills");
    for (const skill of input.skills) {
      capParts.push(`- ${skill}`);
    }
  }

  const capabilities = capParts.join("\n");

  // --- Context Layer ---
  const contextParts: string[] = [];

  if (input.additionalContext) {
    contextParts.push("## Current Context");
    contextParts.push(input.additionalContext);
  }

  const context = contextParts.join("\n");

  return { identity, capabilities, context };
}

/**
 * Assemble layers into a single system prompt.
 * The format differs slightly between engine types.
 */
function assembleLayers(layers: SystemPromptLayers, engineType: string): string {
  const sections: string[] = [];

  // For openclaw engines, use XML-style tags for clear layer separation.
  // For other engines (claude_local, etc.), use markdown sections.
  if (engineType === "openclaw") {
    if (layers.identity) {
      sections.push(`<identity>\n${layers.identity}\n</identity>`);
    }
    if (layers.capabilities) {
      sections.push(`<capabilities>\n${layers.capabilities}\n</capabilities>`);
    }
    if (layers.context) {
      sections.push(`<context>\n${layers.context}\n</context>`);
    }
  } else {
    // Markdown-style for claude_local, codex_local, etc.
    if (layers.identity) {
      sections.push(layers.identity);
    }
    if (layers.capabilities) {
      sections.push(layers.capabilities);
    }
    if (layers.context) {
      sections.push(layers.context);
    }
  }

  return sections.join("\n\n---\n\n");
}

/**
 * Serialize a soul field to SOUL.md content for bidirectional sync
 * with openclaw file-based agents.
 */
export function soulToMarkdown(name: string, soul: string | null): string {
  const lines: string[] = [];
  lines.push(`# ${name} — Soul`);
  lines.push("");

  if (soul) {
    lines.push(soul);
  } else {
    lines.push("_No soul configuration defined._");
  }

  return lines.join("\n");
}

/**
 * Parse SOUL.md content back into the soul text field.
 * Strips the header line and returns the body.
 */
export function markdownToSoul(markdown: string): string {
  const lines = markdown.split("\n");

  // Skip the header (first non-empty line starting with #)
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.startsWith("#")) {
      startIdx = i + 1;
      break;
    }
  }

  // Skip blank lines after header
  while (startIdx < lines.length && lines[startIdx]!.trim() === "") {
    startIdx++;
  }

  const body = lines.slice(startIdx).join("\n").trim();

  // Return null-equivalent for placeholder text
  if (body === "_No soul configuration defined._") {
    return "";
  }

  return body;
}
