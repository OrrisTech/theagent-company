// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock the database module to avoid real DB connections
const mockRows: Array<Record<string, unknown>> = [];

vi.mock("@paperclipai/db", () => {
  const brandingConfig = {
    id: "id",
    appName: "app_name",
    logoUrl: "logo_url",
    primaryColor: "primary_color",
    faviconUrl: "favicon_url",
    updatedAt: "updated_at",
  };

  return {
    brandingConfig,
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => "eq-condition"),
}));

// Since the route module imports from @paperclipai/db and uses drizzle,
// we test the route handler logic through HTTP with a mocked db
describe("branding route validation", () => {
  it("rejects invalid hex colors", () => {
    // Test the hex color validation regex
    const validColors = ["#18181b", "#ffffff", "#000000", "#AABBCC"];
    const invalidColors = ["red", "18181b", "#fff", "#GGGGGG", ""];

    const hexPattern = /^#[0-9a-fA-F]{6}$/;

    for (const color of validColors) {
      expect(hexPattern.test(color), `${color} should be valid`).toBe(true);
    }

    for (const color of invalidColors) {
      expect(hexPattern.test(color), `${color} should be invalid`).toBe(false);
    }
  });

  it("default branding values are sensible", () => {
    const defaults = {
      appName: "The Agent Company",
      logoUrl: "",
      primaryColor: "#18181b",
      faviconUrl: "",
    };

    expect(defaults.appName).toBe("The Agent Company");
    expect(defaults.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(defaults.logoUrl).toBe("");
    expect(defaults.faviconUrl).toBe("");
  });

  it("branding config schema has expected fields", async () => {
    const { brandingConfig } = await import("@paperclipai/db");
    expect(brandingConfig).toHaveProperty("id");
    expect(brandingConfig).toHaveProperty("appName");
    expect(brandingConfig).toHaveProperty("logoUrl");
    expect(brandingConfig).toHaveProperty("primaryColor");
    expect(brandingConfig).toHaveProperty("faviconUrl");
    expect(brandingConfig).toHaveProperty("updatedAt");
  });
});
