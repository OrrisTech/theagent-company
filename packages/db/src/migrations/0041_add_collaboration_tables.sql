-- Phase 6: Team Collaboration Enhancement tables
-- Adds 9 tables for messaging, daily reports, peer reviews, escalation,
-- notifications, performance metrics, onboarding, and feedback.

-- 1. Agent-to-Agent Messaging
CREATE TABLE IF NOT EXISTS "team_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "from_agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "to_agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "parent_id" uuid,
  "issue_id" uuid REFERENCES "issues"("id") ON DELETE SET NULL,
  "content" text NOT NULL,
  "status" text DEFAULT 'sent' NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "read_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "team_messages_company_idx" ON "team_messages" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "team_messages_from_idx" ON "team_messages" USING btree ("from_agent_id");
CREATE INDEX IF NOT EXISTS "team_messages_to_idx" ON "team_messages" USING btree ("to_agent_id");
CREATE INDEX IF NOT EXISTS "team_messages_parent_idx" ON "team_messages" USING btree ("parent_id");
CREATE INDEX IF NOT EXISTS "team_messages_issue_idx" ON "team_messages" USING btree ("issue_id");

-- 2. Daily Reports / Standups
CREATE TABLE IF NOT EXISTS "daily_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "report_date" text NOT NULL,
  "completed_tasks" jsonb DEFAULT '[]' NOT NULL,
  "in_progress_tasks" jsonb DEFAULT '[]' NOT NULL,
  "blockers" jsonb DEFAULT '[]' NOT NULL,
  "planned_tasks" jsonb DEFAULT '[]' NOT NULL,
  "summary" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "total_cost_cents" integer,
  "tasks_completed_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "daily_reports_company_idx" ON "daily_reports" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "daily_reports_agent_idx" ON "daily_reports" USING btree ("agent_id");
CREATE INDEX IF NOT EXISTS "daily_reports_date_idx" ON "daily_reports" USING btree ("report_date");
CREATE INDEX IF NOT EXISTS "daily_reports_agent_date_idx" ON "daily_reports" USING btree ("agent_id", "report_date");

-- 3. Peer Reviews
CREATE TABLE IF NOT EXISTS "peer_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "issue_id" uuid NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
  "author_agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "reviewer_agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'pending' NOT NULL,
  "decision" text,
  "comment" text,
  "content_snapshot" text,
  "revision" integer DEFAULT 1 NOT NULL,
  "requested_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "peer_reviews_company_idx" ON "peer_reviews" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "peer_reviews_issue_idx" ON "peer_reviews" USING btree ("issue_id");
CREATE INDEX IF NOT EXISTS "peer_reviews_author_idx" ON "peer_reviews" USING btree ("author_agent_id");
CREATE INDEX IF NOT EXISTS "peer_reviews_reviewer_idx" ON "peer_reviews" USING btree ("reviewer_agent_id");
CREATE INDEX IF NOT EXISTS "peer_reviews_status_idx" ON "peer_reviews" USING btree ("status");

-- 4. Escalation Protocol
CREATE TABLE IF NOT EXISTS "escalation_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "trigger_type" text NOT NULL,
  "trigger_config" jsonb NOT NULL,
  "target_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "escalate_to_human" boolean DEFAULT false NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "escalation_rules_company_idx" ON "escalation_rules" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "escalation_rules_trigger_idx" ON "escalation_rules" USING btree ("trigger_type");

CREATE TABLE IF NOT EXISTS "escalation_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "rule_id" uuid REFERENCES "escalation_rules"("id") ON DELETE SET NULL,
  "source_agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "target_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "issue_id" uuid REFERENCES "issues"("id") ON DELETE SET NULL,
  "trigger_type" text NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "reason" text NOT NULL,
  "resolution" text,
  "resolved_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "escalation_events_company_idx" ON "escalation_events" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "escalation_events_source_idx" ON "escalation_events" USING btree ("source_agent_id");
CREATE INDEX IF NOT EXISTS "escalation_events_status_idx" ON "escalation_events" USING btree ("status");
CREATE INDEX IF NOT EXISTS "escalation_events_rule_idx" ON "escalation_events" USING btree ("rule_id");

-- 5. Notification Center
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "user_id" text,
  "type" text NOT NULL,
  "priority" text DEFAULT 'medium' NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "ref_type" text,
  "ref_id" text,
  "channels" jsonb DEFAULT '["web"]' NOT NULL,
  "read" boolean DEFAULT false NOT NULL,
  "dismissed" boolean DEFAULT false NOT NULL,
  "action_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "read_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "notifications_company_idx" ON "notifications" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "notifications_type_idx" ON "notifications" USING btree ("type");
CREATE INDEX IF NOT EXISTS "notifications_read_idx" ON "notifications" USING btree ("read");
CREATE INDEX IF NOT EXISTS "notifications_priority_idx" ON "notifications" USING btree ("priority");

-- 6. Performance Snapshots
CREATE TABLE IF NOT EXISTS "performance_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "agent_id" uuid REFERENCES "agents"("id") ON DELETE CASCADE,
  "period_date" text NOT NULL,
  "tasks_assigned" integer DEFAULT 0 NOT NULL,
  "tasks_completed" integer DEFAULT 0 NOT NULL,
  "workflow_runs" integer DEFAULT 0 NOT NULL,
  "workflow_successes" integer DEFAULT 0 NOT NULL,
  "avg_response_time_ms" integer,
  "total_cost_cents" integer DEFAULT 0 NOT NULL,
  "peer_reviews_submitted" integer DEFAULT 0 NOT NULL,
  "peer_reviews_passed" integer DEFAULT 0 NOT NULL,
  "human_edits" integer DEFAULT 0 NOT NULL,
  "total_outputs" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "perf_snapshots_company_idx" ON "performance_snapshots" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "perf_snapshots_agent_idx" ON "performance_snapshots" USING btree ("agent_id");
CREATE INDEX IF NOT EXISTS "perf_snapshots_period_idx" ON "performance_snapshots" USING btree ("period_date");
CREATE INDEX IF NOT EXISTS "perf_snapshots_agent_period_idx" ON "performance_snapshots" USING btree ("agent_id", "period_date");

-- 7. Onboarding Flows
CREATE TABLE IF NOT EXISTS "onboarding_flows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'pending' NOT NULL,
  "steps" jsonb DEFAULT '[]' NOT NULL,
  "test_task_issue_id" uuid REFERENCES "issues"("id") ON DELETE SET NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "onboarding_flows_company_idx" ON "onboarding_flows" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "onboarding_flows_agent_idx" ON "onboarding_flows" USING btree ("agent_id");
CREATE INDEX IF NOT EXISTS "onboarding_flows_status_idx" ON "onboarding_flows" USING btree ("status");

-- 8. Feedback Loop
CREATE TABLE IF NOT EXISTS "feedback_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "issue_id" uuid REFERENCES "issues"("id") ON DELETE SET NULL,
  "user_id" text NOT NULL,
  "category" text DEFAULT 'general' NOT NULL,
  "feedback" text NOT NULL,
  "suggested_update" jsonb,
  "status" text DEFAULT 'pending' NOT NULL,
  "applied" boolean DEFAULT false NOT NULL,
  "applied_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "feedback_entries_company_idx" ON "feedback_entries" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "feedback_entries_agent_idx" ON "feedback_entries" USING btree ("agent_id");
CREATE INDEX IF NOT EXISTS "feedback_entries_status_idx" ON "feedback_entries" USING btree ("status");
CREATE INDEX IF NOT EXISTS "feedback_entries_category_idx" ON "feedback_entries" USING btree ("category");
CREATE INDEX IF NOT EXISTS "feedback_entries_user_idx" ON "feedback_entries" USING btree ("user_id");
