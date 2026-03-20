-- Add role_label column to workflow_steps table.
-- Stores an optional human-readable role label (e.g. '写手', '主编')
-- that is displayed on step cards in the workflow execution view.
ALTER TABLE "workflow_steps" ADD COLUMN "role_label" text;
