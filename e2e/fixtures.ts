import "./env";
import { test as base, type APIRequestContext } from "@playwright/test";

/** 通过真实 HTTP API 准备和检查 E2E 数据，不依赖应用构建产物。 */
export class TestApiClient {
  constructor(
    private readonly request: APIRequestContext,
    readonly baseURL = process.env.E2E_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
  ) {}

  getHealth() {
    return this.request.get(`${this.baseURL.replace(/\/$/, "")}/api/health`);
  }
}

export const test = base.extend<{ api: TestApiClient }>({
  api: async ({ request }, use) => {
    await use(new TestApiClient(request));
  },
});

export { expect } from "@playwright/test";
