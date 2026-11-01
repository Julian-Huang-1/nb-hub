import { healthSchema, type Health } from "./types";

export interface ApiClient {
  getHealth(): Promise<Health>;
}

export function createApiClient(baseUrl: string): ApiClient {
  const normalized = baseUrl.replace(/\/$/, "");
  return {
    async getHealth() {
      const response = await fetch(`${normalized}/api/health`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      return healthSchema.parse(await response.json());
    },
  };
}
