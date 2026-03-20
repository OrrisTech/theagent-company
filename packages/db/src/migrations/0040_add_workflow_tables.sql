-- Phase 5: Workflow System — 6 new tables
-- workflows, workflow_versions, workflow_steps, workflow_runs, workflow_step_runs, workflow_templates

CREATE TABLE IF NOT EXISTS "workflows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "params" jsonb,
  "max_concurrency" integer,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "workflows_company_idx" ON "workflows" ("company_id");
CREATE INDEX IF NOT EXISTS "workflows_status_idx" ON "workflows" ("status");

CREATE TABLE IF NOT EXISTS "workflow_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workflow_id" uuid NOT NULL REFERENCES "workflows"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "label" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "workflow_versions_workflow_idx" ON "workflow_versions" ("workflow_id");
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_versions_unique_idx" ON "workflow_versions" ("workflow_id", "version");

CREATE TABLE IF NOT EXISTS "workflow_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workflow_version_id" uuid NOT NULL REFERENCES "workflow_versions"("id") ON DELETE CASCADE,
  "step_index" integer NOT NULL,
  "name" text NOT NULL,
  "type" text NOT NULL,
  "config" jsonb NOT NULL,
  "input_refs" jsonb,
  "timeout_seconds" integer,
  "retries" integer,
  "fallback_output" text,
  "is_checkpoint" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "workflow_steps_version_idx" ON "workflow_steps" ("workflow_version_id");
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_steps_unique_idx" ON "workflow_steps" ("workflow_version_id", "step_index");

CREATE TABLE IF NOT EXISTS "workflow_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workflow_id" uuid NOT NULL REFERENCES "workflows"("id") ON DELETE CASCADE,
  "workflow_version_id" uuid NOT NULL REFERENCES "workflow_versions"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "issue_id" uuid REFERENCES "issues"("id") ON DELETE SET NULL,
  "cron_task_id" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "trigger" text NOT NULL,
  "params" jsonb,
  "debug_mode" boolean DEFAULT false NOT NULL,
  "debug_pause_at_step" integer,
  "total_cost_cents" integer,
  "total_duration_ms" integer,
  "error" text,
  "last_checkpoint_step" integer,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "workflow_runs_workflow_idx" ON "workflow_runs" ("workflow_id");
CREATE INDEX IF NOT EXISTS "workflow_runs_company_idx" ON "workflow_runs" ("company_id");
CREATE INDEX IF NOT EXISTS "workflow_runs_status_idx" ON "workflow_runs" ("status");
CREATE INDEX IF NOT EXISTS "workflow_runs_issue_idx" ON "workflow_runs" ("issue_id");

CREATE TABLE IF NOT EXISTS "workflow_step_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workflow_run_id" uuid NOT NULL REFERENCES "workflow_runs"("id") ON DELETE CASCADE,
  "workflow_step_id" uuid NOT NULL REFERENCES "workflow_steps"("id") ON DELETE CASCADE,
  "step_index" integer NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "input" jsonb,
  "output" jsonb,
  "cost_cents" integer,
  "duration_ms" integer,
  "error" text,
  "retry_attempt" integer DEFAULT 0 NOT NULL,
  "approved_by_user_id" text,
  "approval_decision" text,
  "loop_iteration" integer,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "workflow_step_runs_run_idx" ON "workflow_step_runs" ("workflow_run_id");
CREATE INDEX IF NOT EXISTS "workflow_step_runs_step_idx" ON "workflow_step_runs" ("workflow_step_id");
CREATE INDEX IF NOT EXISTS "workflow_step_runs_status_idx" ON "workflow_step_runs" ("status");

CREATE TABLE IF NOT EXISTS "workflow_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text,
  "steps_json" jsonb NOT NULL,
  "params_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "workflow_templates_category_idx" ON "workflow_templates" ("category");
