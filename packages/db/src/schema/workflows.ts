import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { issues } from "./issues.js";
import type {
  WorkflowStatus,
  WorkflowRunStatus,
  WorkflowStepRunStatus,
  WorkflowRunTrigger,
  WorkflowStepType,
} from "@theagentcompany/shared";
import type {
  WorkflowParam,
  WorkflowStepConfig,
  WorkflowTemplateStep,
} from "@theagentcompany/shared";

/**
 * `workflows` table — reusable workflow definitions (SOPs).
 *
 * Each workflow belongs to a company and defines a named process
 * that can be triggered manually, by a task, or by a cron schedule.
 * Steps are stored per-version in `workflow_steps`.
 */
export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** Human-readable name for the workflow. */
    name: text("name").notNull(),
    /** Optional longer description of what the workflow does. */
    description: text("description"),
    /** Lifecycle status: draft, active, or archived. */
    status: text("status").$type<WorkflowStatus>().notNull().default("draft"),
    /** JSON array of parameter definitions the workflow accepts at run time. */
    params: jsonb("params").$type<WorkflowParam[]>(),
    /** Maximum concurrent runs allowed for this workflow (null = use system default). */
    maxConcurrency: integer("max_concurrency"),
    /** User who created the workflow. */
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("workflows_company_idx").on(table.companyId),
    statusIdx: index("workflows_status_idx").on(table.status),
  }),
);

/**
 * `workflow_versions` table — immutable snapshots of a workflow's step list.
 *
 * Every time the user saves changes to a workflow's steps, a new version
 * row is created. The version number is auto-incremented per workflow.
 */
export const workflowVersions = pgTable(
  "workflow_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    /** Monotonically increasing version number within this workflow. */
    version: integer("version").notNull(),
    /** Optional human-readable label (e.g. "v2 — added approval step"). */
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workflowIdx: index("workflow_versions_workflow_idx").on(table.workflowId),
    uniqueVersionIdx: uniqueIndex("workflow_versions_unique_idx").on(
      table.workflowId,
      table.version,
    ),
  }),
);

/**
 * `workflow_steps` table — individual step definitions within a version.
 *
 * Steps are ordered by `step_index`. Each step has a type and a JSONB
 * config blob whose shape depends on the type.
 */
export const workflowSteps = pgTable(
  "workflow_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowVersionId: uuid("workflow_version_id")
      .notNull()
      .references(() => workflowVersions.id, { onDelete: "cascade" }),
    /** Zero-based position within the step list. */
    stepIndex: integer("step_index").notNull(),
    /** Human-readable name for this step. */
    name: text("name").notNull(),
    /** Step type: prompt, skill, api, cli, tool_use, approval, condition, loop, workflow. */
    type: text("type").$type<WorkflowStepType>().notNull(),
    /** Type-specific configuration (see WorkflowStepConfig union). */
    config: jsonb("config").$type<WorkflowStepConfig>().notNull(),
    /** Template expressions referencing prior step outputs. */
    inputRefs: jsonb("input_refs").$type<string[]>(),
    /** Step timeout in seconds. Null = no timeout. */
    timeoutSeconds: integer("timeout_seconds"),
    /** Number of automatic retries on failure. */
    retries: integer("retries"),
    /** Fallback output if the step fails after all retries. */
    fallbackOutput: text("fallback_output"),
    /** Whether this step is a checkpoint for resume-from-failure. */
    isCheckpoint: boolean("is_checkpoint").notNull().default(false),
    /** Retention priority for context compression (critical > high > medium > low). */
    retentionPriority: text("retention_priority").default("medium"),
    /** Optional role label displayed on step cards (e.g. '写手', '主编'). */
    roleLabel: text("role_label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    versionIdx: index("workflow_steps_version_idx").on(table.workflowVersionId),
    uniqueStepIdx: uniqueIndex("workflow_steps_unique_idx").on(
      table.workflowVersionId,
      table.stepIndex,
    ),
  }),
);

/**
 * `workflow_runs` table — execution instances of a workflow.
 *
 * Each run is bound to a specific workflow version and tracks overall
 * execution state, cost, and timing.
 */
export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    workflowVersionId: uuid("workflow_version_id")
      .notNull()
      .references(() => workflowVersions.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** The agent executing the workflow (optional). */
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    /** The task (issue) this run is bound to (optional). */
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    /** External cron task identifier that triggered this run (optional). */
    cronTaskId: text("cron_task_id"),
    /** Overall run status. */
    status: text("status").$type<WorkflowRunStatus>().notNull().default("pending"),
    /** What triggered this run. */
    trigger: text("trigger").$type<WorkflowRunTrigger>().notNull(),
    /** Parameters passed at execution time. */
    params: jsonb("params").$type<Record<string, unknown>>(),
    /** Whether the run is in debug (step-by-step) mode. */
    debugMode: boolean("debug_mode").notNull().default(false),
    /** In debug mode, the step index where execution should pause. */
    debugPauseAtStep: integer("debug_pause_at_step"),
    /** Accumulated cost in cents across all steps. */
    totalCostCents: integer("total_cost_cents"),
    /** Total wall-clock duration in milliseconds. */
    totalDurationMs: integer("total_duration_ms"),
    /** Error message if the run failed. */
    error: text("error"),
    /** Step index of the last successful checkpoint (for resume). */
    lastCheckpointStep: integer("last_checkpoint_step"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workflowIdx: index("workflow_runs_workflow_idx").on(table.workflowId),
    companyIdx: index("workflow_runs_company_idx").on(table.companyId),
    statusIdx: index("workflow_runs_status_idx").on(table.status),
    issueIdx: index("workflow_runs_issue_idx").on(table.issueId),
  }),
);

/**
 * `workflow_step_runs` table — execution records for individual steps.
 *
 * Each row tracks the input, output, cost, duration, and status of
 * one step execution within a workflow run.
 */
export const workflowStepRuns = pgTable(
  "workflow_step_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowRunId: uuid("workflow_run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    workflowStepId: uuid("workflow_step_id")
      .notNull()
      .references(() => workflowSteps.id, { onDelete: "cascade" }),
    /** Denormalized step index for efficient ordering. */
    stepIndex: integer("step_index").notNull(),
    /** Step execution status. */
    status: text("status").$type<WorkflowStepRunStatus>().notNull().default("pending"),
    /** Resolved input data fed to this step. */
    input: jsonb("input"),
    /** Output produced by this step. */
    output: jsonb("output"),
    /** Cost in cents for this step execution. */
    costCents: integer("cost_cents"),
    /** Duration in milliseconds. */
    durationMs: integer("duration_ms"),
    /** Error message if this step failed. */
    error: text("error"),
    /** Retry attempt number (0 = first attempt). */
    retryAttempt: integer("retry_attempt").notNull().default(0),
    /** For approval steps: the user who approved or rejected. */
    approvedByUserId: text("approved_by_user_id"),
    /** For approval steps: the decision made. */
    approvalDecision: text("approval_decision").$type<"approved" | "rejected">(),
    /** For loop steps: current iteration index. */
    loopIteration: integer("loop_iteration"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runIdx: index("workflow_step_runs_run_idx").on(table.workflowRunId),
    stepIdx: index("workflow_step_runs_step_idx").on(table.workflowStepId),
    statusIdx: index("workflow_step_runs_status_idx").on(table.status),
  }),
);

/**
 * `workflow_templates` table — pre-built workflow templates.
 *
 * Templates can be imported to create new workflows with a pre-defined
 * set of steps. They are global (not company-scoped).
 */
export const workflowTemplates = pgTable(
  "workflow_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Template name. */
    name: text("name").notNull(),
    /** Description of what the template does. */
    description: text("description"),
    /** Category for filtering (e.g. "content", "analysis", "operations"). */
    category: text("category"),
    /** JSON array of step definitions. */
    stepsJson: jsonb("steps_json").$type<WorkflowTemplateStep[]>().notNull(),
    /** Default parameter definitions for workflows created from this template. */
    paramsJson: jsonb("params_json").$type<WorkflowParam[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    categoryIdx: index("workflow_templates_category_idx").on(table.category),
  }),
);
