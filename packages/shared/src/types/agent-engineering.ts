// ---------------------------------------------------------------------------
// Phase 8 — Agent Engineering Hardening types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 8.3 Context Compression
// ---------------------------------------------------------------------------

/** Priority levels for retaining step output data during context compression. */
export type RetentionPriority = "critical" | "high" | "medium" | "low";

/** Budget configuration for workflow context compression. */
export interface ContextBudget {
  /** Maximum total characters allowed in the inter-step context window. */
  maxTotalChars: number;
  /** Maximum characters allowed for a single step's output before compression. */
  maxStepOutputChars: number;
  /** Default retention priority for steps that don't specify one. */
  defaultRetentionPriority: RetentionPriority;
}

/** Result of compressing a step output. */
export interface CompressedOutput {
  /** The compressed (summarized) output. */
  summary: string;
  /** Whether the output was actually compressed (or passed through). */
  wasCompressed: boolean;
  /** Original size in characters. */
  originalSize: number;
  /** Compressed size in characters. */
  compressedSize: number;
}

// ---------------------------------------------------------------------------
// 8.4 Soul Layer Injection
// ---------------------------------------------------------------------------

/** Layers of a system prompt built from a Team Member's configuration. */
export interface SystemPromptLayers {
  /** Identity layer: name, soul/personality, behavioral guidelines. */
  identity: string;
  /** Capabilities layer: job description, skills, available tools. */
  capabilities: string;
  /** Context layer: current task, workflow state, recent memory. */
  context: string;
}

/** Input for building a system prompt from Team Member data. */
export interface SoulInjectionInput {
  /** Team member name. */
  name: string;
  /** Soul/personality text (maps to SOUL.md for openclaw). */
  soul: string | null;
  /** Job description / capabilities text. */
  jobDescription: string | null;
  /** Engine type determines the injection path. */
  engineType: string;
  /** Optional skill names available to the agent. */
  skills?: string[];
  /** Optional additional context (current task, memory, etc.). */
  additionalContext?: string;
}

/** Result of building a system prompt. */
export interface SoulInjectionResult {
  /** The fully assembled system prompt. */
  systemPrompt: string;
  /** The individual layers (for debugging / logging). */
  layers: SystemPromptLayers;
}

// ---------------------------------------------------------------------------
// 8.5 Source-Sink Security
// ---------------------------------------------------------------------------

/** Known sources of untrusted external data. */
export type UntrustedSource =
  | "web_fetch"
  | "email"
  | "webhook"
  | "user_input"
  | "api_response"
  | "file_upload";

/** Wrapped untrusted content with source provenance. */
export interface UntrustedContent {
  /** Sentinel marker for type-checking. */
  __untrusted: true;
  /** Where the data came from. */
  source: UntrustedSource;
  /** The raw content string. */
  content: string;
  /** ISO timestamp when the content was received. */
  receivedAt: string;
}

/** Operations that require explicit confirmation before executing. */
export type SensitiveOperation =
  | "external_api_call"
  | "send_message"
  | "delete_resource"
  | "modify_permissions"
  | "execute_command"
  | "financial_transaction";

/** A single entry in the security audit log. */
export interface SecurityAuditEntry {
  /** Unique event ID. */
  id: string;
  /** ISO timestamp. */
  timestamp: string;
  /** Company scope. */
  companyId: string;
  /** Agent or user that triggered the event. */
  actorId: string;
  /** Type of actor. */
  actorType: "agent" | "user" | "system";
  /** What happened. */
  action: string;
  /** Source of the content (if untrusted data was involved). */
  source?: UntrustedSource;
  /** Whether the operation was confirmed by a human. */
  confirmed?: boolean;
  /** Additional details. */
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 8.6 Provider Fallback
// ---------------------------------------------------------------------------

/** A single provider entry in the fallback chain. */
export interface ProviderEntry {
  /** Provider identifier (e.g. "anthropic", "openai", "google"). */
  provider: string;
  /** Model to use with this provider. */
  model: string;
  /** Optional timeout in milliseconds for this provider. */
  timeoutMs?: number;
}

/** Configuration for provider fallback behavior. */
export interface ProviderFallbackConfig {
  /** Ordered list of providers to try. First is primary. */
  providers: ProviderEntry[];
  /** HTTP status codes that trigger a fallback (default: [429, 503]). */
  retryableStatusCodes?: number[];
  /** Maximum number of retries across all providers. */
  maxRetries?: number;
}

/** Result of a provider call attempt. */
export interface ProviderCallResult<T = unknown> {
  /** The response data if successful. */
  data?: T;
  /** Whether the call succeeded. */
  success: boolean;
  /** The provider that was used. */
  provider: string;
  /** The model that was used. */
  model: string;
  /** Number of fallback switches that occurred. */
  fallbackCount: number;
  /** Error details if the call failed. */
  error?: string;
  /** Duration in milliseconds. */
  durationMs: number;
}

/** A fallback switch event recorded in the audit trail. */
export interface ProviderSwitchEvent {
  /** ISO timestamp. */
  timestamp: string;
  /** Provider that failed. */
  fromProvider: string;
  /** Provider switched to. */
  toProvider: string;
  /** Reason for the switch. */
  reason: string;
  /** HTTP status code that triggered the switch (if applicable). */
  statusCode?: number;
}

// ---------------------------------------------------------------------------
// 8.7 Skills ACI Format
// ---------------------------------------------------------------------------

/** ACI (Agent-Computer Interface) format for skill descriptions. */
export interface SkillACI {
  /** Human-readable skill name. */
  name: string;
  /** When to use this skill — trigger conditions. */
  useWhen: string[];
  /** When NOT to use this skill — exclusion conditions. */
  dontUseWhen: string[];
  /** Expected output format description. */
  outputFormat: string;
  /** Optional examples. */
  examples?: string[];
}

// ---------------------------------------------------------------------------
// 8.8 Event Stream Tracing
// ---------------------------------------------------------------------------

/** Event types emitted during agent execution. */
export type AgentEventType =
  | "tool_start"
  | "tool_end"
  | "turn_start"
  | "turn_end"
  | "step_start"
  | "step_end"
  | "error"
  | "provider_switch"
  | "context_compressed";

/** A single event in the agent execution trace. */
export interface AgentTraceEvent {
  /** Unique event ID. */
  id: string;
  /** Event type. */
  type: AgentEventType;
  /** ISO timestamp. */
  timestamp: string;
  /** Company scope. */
  companyId: string;
  /** The agent that generated this event. */
  agentId: string;
  /** Workflow run ID (if executing a workflow). */
  runId?: string;
  /** Step index (if within a workflow step). */
  stepIndex?: number;
  /** Tool name (for tool_start/tool_end events). */
  toolName?: string;
  /** Duration in milliseconds (for _end events). */
  durationMs?: number;
  /** Additional structured data. */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 8.2 Eval Framework
// ---------------------------------------------------------------------------

/** Types of eval tests. */
export type EvalTestType = "capability" | "regression";

/** Result of a single eval case. */
export interface EvalCaseResult {
  /** Unique case identifier. */
  caseId: string;
  /** Human-readable name. */
  name: string;
  /** Whether the case is a capability or regression test. */
  type: EvalTestType;
  /** Whether the case passed. */
  passed: boolean;
  /** Score (0-1) for graded evaluations. */
  score?: number;
  /** Error message if the case failed. */
  error?: string;
  /** Duration in milliseconds. */
  durationMs: number;
}

/** Summary of an eval run. */
export interface EvalRunSummary {
  /** Total number of cases. */
  totalCases: number;
  /** Number of cases that passed. */
  passed: number;
  /** Number of cases that failed. */
  failed: number;
  /** Capability test pass rate (pass@k). */
  capabilityPassRate: number;
  /** Regression test pass rate (pass^k — all must pass). */
  regressionPassRate: number;
  /** Individual case results. */
  results: EvalCaseResult[];
  /** Total duration in milliseconds. */
  totalDurationMs: number;
}
