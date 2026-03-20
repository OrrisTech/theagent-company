import type {
  WorkflowStepType,
  WorkflowStatus,
  WorkflowRunStatus,
  WorkflowStepRunStatus,
  WorkflowRunTrigger,
} from "../constants.js";

// ---------------------------------------------------------------------------
// Step configuration — per-type config stored in workflow_steps.config JSONB
// ---------------------------------------------------------------------------

/** Configuration for a "prompt" step — LLM generation with optional skill. */
export interface WorkflowStepPromptConfig {
  /** The prompt template. May contain {{stepN.output}} references. */
  prompt: string;
  /** Optional skill identifier to bind to the LLM call. */
  skillId?: string;
  /** Optional model override for this step. */
  model?: string;
}

/** Configuration for a "skill" step — invoke an OpenClaw skill. */
export interface WorkflowStepSkillConfig {
  /** The skill identifier to invoke. */
  skillId: string;
  /** Parameters to pass to the skill (may contain template refs). */
  params?: Record<string, unknown>;
}

/** Configuration for an "api" step — call an external HTTP endpoint. */
export interface WorkflowStepApiConfig {
  /** HTTP method. */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Target URL (may contain template refs). */
  url: string;
  /** Optional request headers. */
  headers?: Record<string, string>;
  /** Optional request body (may contain template refs). */
  body?: string;
}

/** Configuration for a "cli" step — execute a command. */
export interface WorkflowStepCliConfig {
  /** The command to run (may contain template refs). */
  command: string;
  /** Optional working directory. */
  cwd?: string;
}

/** Configuration for a "tool_use" step — browser or tool automation. */
export interface WorkflowStepToolUseConfig {
  /** Tool identifier (e.g. "browser", "screenshot"). */
  toolId: string;
  /** Parameters for the tool invocation. */
  params?: Record<string, unknown>;
}

/** Configuration for an "approval" step — pause for human review. */
export interface WorkflowStepApprovalConfig {
  /** Message displayed to the reviewer. */
  prompt: string;
  /** Optional list of user IDs who can approve. Empty = any board member. */
  approvers?: string[];
}

/** Configuration for a "condition" step — if/else branching. */
export interface WorkflowStepConditionConfig {
  /** A JavaScript-safe expression evaluated against step outputs. */
  expression: string;
  /** Step index to jump to when the condition is true. */
  thenStep: number;
  /** Step index to jump to when the condition is false (optional, defaults to next). */
  elseStep?: number;
}

/** Configuration for a "loop" step — iterate over a collection. */
export interface WorkflowStepLoopConfig {
  /** Template expression that resolves to an iterable (e.g. "{{step1.output.items}}"). */
  collection: string;
  /** Variable name for the current item (available as {{loop.item}}). */
  itemVariable?: string;
  /** Step index of the first step in the loop body. */
  bodyStartStep: number;
  /** Step index of the last step in the loop body (inclusive). */
  bodyEndStep: number;
  /** Maximum iterations (safety limit). */
  maxIterations?: number;
}

/** Configuration for a nested "workflow" step — invoke another workflow. */
export interface WorkflowStepWorkflowConfig {
  /** The workflow ID to invoke. */
  workflowId: string;
  /** Parameters to pass to the nested workflow. */
  params?: Record<string, unknown>;
}

/** Union of all step config types. */
export type WorkflowStepConfig =
  | WorkflowStepPromptConfig
  | WorkflowStepSkillConfig
  | WorkflowStepApiConfig
  | WorkflowStepCliConfig
  | WorkflowStepToolUseConfig
  | WorkflowStepApprovalConfig
  | WorkflowStepConditionConfig
  | WorkflowStepLoopConfig
  | WorkflowStepWorkflowConfig;

// ---------------------------------------------------------------------------
// Domain types — correspond to database rows
// ---------------------------------------------------------------------------

/** A workflow definition (the "what" — reusable process template). */
export interface Workflow {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  /** Parameters the workflow accepts at execution time. */
  params: WorkflowParam[] | null;
  /** System-level concurrency limit override for this workflow. */
  maxConcurrency: number | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A parameter definition for a workflow. */
export interface WorkflowParam {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "json";
  required: boolean;
  defaultValue?: unknown;
}

/** A versioned snapshot of a workflow's steps. */
export interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  /** Human-readable label for this version (optional). */
  label: string | null;
  createdAt: Date;
}

/** A single step within a workflow version. */
export interface WorkflowStep {
  id: string;
  workflowVersionId: string;
  /** Zero-based position in the step list. */
  stepIndex: number;
  /** Human-readable name for this step. */
  name: string;
  type: WorkflowStepType;
  /** Type-specific configuration (prompt, skill config, API details, etc.). */
  config: WorkflowStepConfig;
  /** Template expressions referencing prior step outputs (e.g. ["{{step0.output}}"]).  */
  inputRefs: string[] | null;
  /** Timeout in seconds for this step. */
  timeoutSeconds: number | null;
  /** Number of automatic retries on failure. */
  retries: number | null;
  /** Template expression or literal for fallback output on failure. */
  fallbackOutput: string | null;
  /** Whether this step is a checkpoint for resume-from-failure. */
  isCheckpoint: boolean;
  /** Retention priority for context compression (critical > high > medium > low). */
  retentionPriority: string | null;
  createdAt: Date;
}

/** A single execution instance of a workflow. */
export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  companyId: string;
  /** The agent executing the workflow, if any. */
  agentId: string | null;
  /** The task bound to this run, if any. */
  issueId: string | null;
  /** The cron job that triggered this run, if any. */
  cronTaskId: string | null;
  status: WorkflowRunStatus;
  trigger: WorkflowRunTrigger;
  /** Parameters passed at execution time. */
  params: Record<string, unknown> | null;
  /** Whether the run is in debug (step-by-step) mode. */
  debugMode: boolean;
  /** If paused in debug mode, the step index where execution paused. */
  debugPauseAtStep: number | null;
  /** Overall cost in cents for this run. */
  totalCostCents: number | null;
  /** Total duration in milliseconds. */
  totalDurationMs: number | null;
  /** Error message if the run failed. */
  error: string | null;
  /** Step index of the last checkpoint reached (for resume). */
  lastCheckpointStep: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Execution record for a single step within a workflow run. */
export interface WorkflowStepRun {
  id: string;
  workflowRunId: string;
  workflowStepId: string;
  stepIndex: number;
  status: WorkflowStepRunStatus;
  /** Resolved input data for this step execution. */
  input: unknown | null;
  /** Output produced by this step. */
  output: unknown | null;
  /** Cost in cents for this step. */
  costCents: number | null;
  /** Duration in milliseconds. */
  durationMs: number | null;
  /** Error message if this step failed. */
  error: string | null;
  /** Retry attempt number (0 = first attempt). */
  retryAttempt: number;
  /** For approval steps: who approved/rejected. */
  approvedByUserId: string | null;
  /** For approval steps: the approval decision. */
  approvalDecision: "approved" | "rejected" | null;
  /** For loop steps: the current iteration index. */
  loopIteration: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}

/** A pre-built workflow template that can be imported. */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  /** The template step definitions (same shape as WorkflowStep[]). */
  stepsJson: WorkflowTemplateStep[];
  /** Default params for the template. */
  paramsJson: WorkflowParam[] | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A step definition within a workflow template (without IDs). */
export interface WorkflowTemplateStep {
  stepIndex: number;
  name: string;
  type: WorkflowStepType;
  config: WorkflowStepConfig;
  inputRefs?: string[];
  timeoutSeconds?: number;
  retries?: number;
  fallbackOutput?: string;
  isCheckpoint?: boolean;
  /** Retention priority for context compression. */
  retentionPriority?: string;
}

// ---------------------------------------------------------------------------
// API request/response helpers
// ---------------------------------------------------------------------------

/** Input for creating a new workflow. */
export interface CreateWorkflowInput {
  name: string;
  description?: string;
  params?: WorkflowParam[];
  maxConcurrency?: number;
  /** Initial steps (creates version 1). */
  steps: CreateWorkflowStepInput[];
}

/** Input for creating a step within a workflow. */
export interface CreateWorkflowStepInput {
  name: string;
  type: WorkflowStepType;
  config: WorkflowStepConfig;
  inputRefs?: string[];
  timeoutSeconds?: number;
  retries?: number;
  fallbackOutput?: string;
  isCheckpoint?: boolean;
  /** Retention priority for context compression (critical > high > medium > low). */
  retentionPriority?: string;
}

/** Input for updating a workflow (creates a new version). */
export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  status?: WorkflowStatus;
  params?: WorkflowParam[];
  maxConcurrency?: number;
  /** If provided, creates a new version with these steps. */
  steps?: CreateWorkflowStepInput[];
  /** Optional label for the new version. */
  versionLabel?: string;
}

/** Input for manually triggering a workflow run. */
export interface TriggerWorkflowInput {
  /** Optional parameters for the run. */
  params?: Record<string, unknown>;
  /** Optional agent to execute the workflow. */
  agentId?: string;
  /** Optional task to bind the run to. */
  issueId?: string;
  /** Enable debug mode (pause before each step). */
  debugMode?: boolean;
  /** In debug mode, pause at this specific step index. */
  debugPauseAtStep?: number;
}

/** Input for responding to an approval step. */
export interface ApproveStepInput {
  decision: "approved" | "rejected";
}

/** Input for resuming a failed workflow from its last checkpoint. */
export interface ResumeWorkflowInput {
  /** Optionally override the step to resume from. */
  fromStep?: number;
  /** Optionally inject output for a failed step. */
  stepOutput?: unknown;
}

/** Summary stats returned in workflow list responses. */
export interface WorkflowSummary extends Workflow {
  stepCount: number;
  lastRunAt: Date | null;
  lastRunStatus: WorkflowRunStatus | null;
  totalRuns: number;
}
