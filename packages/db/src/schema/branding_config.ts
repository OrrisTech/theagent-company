import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Stores global branding configuration — app name, logo, primary color, favicon.
 * Only one row is expected (singleton pattern), keyed by a fixed UUID.
 */
export const brandingConfig = pgTable("branding_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  appName: text("app_name").notNull().default("The Agent Company"),
  logoUrl: text("logo_url").notNull().default(""),
  primaryColor: text("primary_color").notNull().default("#18181b"),
  faviconUrl: text("favicon_url").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
