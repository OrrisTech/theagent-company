-- Phase 4: Add unified team member fields to agents table
ALTER TABLE "agents" ADD COLUMN "soul" text;
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "identity_meta" jsonb;
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "engine_type" text DEFAULT 'process' NOT NULL;
