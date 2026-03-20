import type { SkillACI } from "@paperclipai/shared";

/**
 * Parse a free-form skill description into ACI (Agent-Computer Interface) format.
 *
 * The parser looks for known patterns:
 * - "Use when" / "Don't use when" / "Output" sections
 * - Bullet points under each section
 * - Falls back to heuristic extraction from unstructured text
 */
export function parseSkillACI(name: string, description: string): SkillACI {
  const lines = description.split("\n").map((l) => l.trim()).filter(Boolean);

  let useWhen: string[] = [];
  let dontUseWhen: string[] = [];
  let outputFormat = "";
  let examples: string[] = [];

  // Try structured parsing first
  let currentSection: "use" | "dont" | "output" | "examples" | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Detect section headers
    if (lower.startsWith("use when") || lower.startsWith("## use when") || lower.startsWith("**use when")) {
      currentSection = "use";
      continue;
    }
    if (
      lower.startsWith("don't use when") ||
      lower.startsWith("do not use when") ||
      lower.startsWith("## don't use when") ||
      lower.startsWith("**don't use when")
    ) {
      currentSection = "dont";
      continue;
    }
    if (lower.startsWith("output") || lower.startsWith("## output") || lower.startsWith("**output")) {
      currentSection = "output";
      continue;
    }
    if (lower.startsWith("example") || lower.startsWith("## example") || lower.startsWith("**example")) {
      currentSection = "examples";
      continue;
    }

    // Collect items for current section
    const cleaned = line.replace(/^[-*•]\s*/, "").trim();
    if (!cleaned) continue;

    switch (currentSection) {
      case "use":
        useWhen.push(cleaned);
        break;
      case "dont":
        dontUseWhen.push(cleaned);
        break;
      case "output":
        outputFormat += (outputFormat ? " " : "") + cleaned;
        break;
      case "examples":
        examples.push(cleaned);
        break;
    }
  }

  // If structured parsing found nothing, use heuristic extraction
  if (useWhen.length === 0 && dontUseWhen.length === 0 && !outputFormat) {
    return extractFromUnstructured(name, description);
  }

  return {
    name,
    useWhen,
    dontUseWhen,
    outputFormat: outputFormat || "Text output",
    examples: examples.length > 0 ? examples : undefined,
  };
}

/**
 * Extract ACI fields from an unstructured description using heuristics.
 * Looks for trigger words, negation patterns, and output mentions.
 */
function extractFromUnstructured(name: string, description: string): SkillACI {
  const sentences = description
    .replace(/\n/g, " ")
    .split(/[.!]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const useWhen: string[] = [];
  const dontUseWhen: string[] = [];
  let outputFormat = "";

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();

    if (lower.includes("use this") || lower.includes("trigger") || lower.includes("invoke when")) {
      useWhen.push(sentence);
    } else if (
      lower.includes("do not use") ||
      lower.includes("don't use") ||
      lower.includes("not suitable") ||
      lower.includes("avoid")
    ) {
      dontUseWhen.push(sentence);
    } else if (lower.includes("output") || lower.includes("returns") || lower.includes("produces")) {
      outputFormat += (outputFormat ? " " : "") + sentence;
    }
  }

  // If still nothing for useWhen, use the first sentence as a general description
  if (useWhen.length === 0 && sentences.length > 0) {
    useWhen.push(sentences[0]!);
  }

  return {
    name,
    useWhen,
    dontUseWhen,
    outputFormat: outputFormat || "Text output",
  };
}

/**
 * Format an ACI structure back into a human-readable description string.
 */
export function formatSkillACI(aci: SkillACI): string {
  const parts: string[] = [];

  if (aci.useWhen.length > 0) {
    parts.push("**Use when:**");
    for (const item of aci.useWhen) {
      parts.push(`- ${item}`);
    }
  }

  if (aci.dontUseWhen.length > 0) {
    parts.push("");
    parts.push("**Don't use when:**");
    for (const item of aci.dontUseWhen) {
      parts.push(`- ${item}`);
    }
  }

  if (aci.outputFormat) {
    parts.push("");
    parts.push(`**Output format:** ${aci.outputFormat}`);
  }

  if (aci.examples && aci.examples.length > 0) {
    parts.push("");
    parts.push("**Examples:**");
    for (const ex of aci.examples) {
      parts.push(`- ${ex}`);
    }
  }

  return parts.join("\n");
}
