-- Phase 8: Add retention_priority column to workflow_steps for context compression
ALTER TABLE "workflow_steps" ADD COLUMN "retention_priority" text DEFAULT 'medium';
