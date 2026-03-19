CREATE TABLE "branding_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_name" text DEFAULT 'The Agent Company' NOT NULL,
	"logo_url" text DEFAULT '' NOT NULL,
	"primary_color" text DEFAULT '#18181b' NOT NULL,
	"favicon_url" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Seed the singleton branding row so GET /api/branding always returns data
INSERT INTO "branding_config" ("app_name", "logo_url", "primary_color", "favicon_url")
VALUES ('The Agent Company', '', '#18181b', '');
