import { Router } from "express";
import { eq } from "drizzle-orm";
import type { Db } from "@theagentcompany/db";
import { brandingConfig } from "@theagentcompany/db";

/**
 * Branding config API.
 * GET  /branding — returns the singleton branding row
 * PUT  /branding — updates branding settings
 */
export function brandingRoutes(db: Db) {
  const router = Router();

  // GET /branding — fetch current branding config
  router.get("/branding", async (_req, res) => {
    const rows = await db.select().from(brandingConfig).limit(1);
    const row = rows[0];

    if (!row) {
      // Return defaults if no row exists (shouldn't happen after migration seed)
      res.json({
        appName: "The Agent Company",
        logoUrl: "",
        primaryColor: "#18181b",
        faviconUrl: "",
      });
      return;
    }

    res.json({
      appName: row.appName,
      logoUrl: row.logoUrl,
      primaryColor: row.primaryColor,
      faviconUrl: row.faviconUrl,
    });
  });

  // PUT /branding — update branding config
  router.put("/branding", async (req, res) => {
    const { appName, logoUrl, primaryColor, faviconUrl } = req.body as {
      appName?: string;
      logoUrl?: string;
      primaryColor?: string;
      faviconUrl?: string;
    };

    // Validate primary color format if provided
    if (primaryColor && !/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
      res.status(400).json({ error: "primaryColor must be a valid hex color (e.g. #18181b)" });
      return;
    }

    // Find existing row
    const rows = await db.select().from(brandingConfig).limit(1);
    const existing = rows[0];

    if (!existing) {
      // Insert new row
      const [inserted] = await db.insert(brandingConfig).values({
        appName: appName ?? "The Agent Company",
        logoUrl: logoUrl ?? "",
        primaryColor: primaryColor ?? "#18181b",
        faviconUrl: faviconUrl ?? "",
      }).returning();

      res.json({
        appName: inserted!.appName,
        logoUrl: inserted!.logoUrl,
        primaryColor: inserted!.primaryColor,
        faviconUrl: inserted!.faviconUrl,
      });
      return;
    }

    // Update existing row
    const [updated] = await db
      .update(brandingConfig)
      .set({
        ...(appName !== undefined && { appName }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(primaryColor !== undefined && { primaryColor }),
        ...(faviconUrl !== undefined && { faviconUrl }),
        updatedAt: new Date(),
      })
      .where(eq(brandingConfig.id, existing.id))
      .returning();

    res.json({
      appName: updated!.appName,
      logoUrl: updated!.logoUrl,
      primaryColor: updated!.primaryColor,
      faviconUrl: updated!.faviconUrl,
    });
  });

  return router;
}
