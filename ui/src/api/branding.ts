import { api } from "./client";

export interface BrandingConfig {
  appName: string;
  logoUrl: string;
  primaryColor: string;
  faviconUrl: string;
}

export const brandingApi = {
  async get(): Promise<BrandingConfig> {
    return api.get<BrandingConfig>("/branding");
  },

  async update(data: BrandingConfig): Promise<BrandingConfig> {
    return api.put<BrandingConfig>("/branding", data);
  },
};
