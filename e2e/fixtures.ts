import "./env";
import { test as base, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";

/** 通过真实 HTTP API 准备和检查 E2E 数据，不依赖应用构建产物。 */
export class TestApiClient {
  constructor(
    private readonly request: APIRequestContext,
    readonly baseURL = process.env.E2E_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
  ) {}

  getHealth() {
    return this.request.get(`${this.baseURL.replace(/\/$/, "")}/api/health`);
  }

  private authURL(path: string) {
    return `${(process.env.PLAYWRIGHT_BASE_URL || process.env.FRONTEND_ORIGIN || "http://localhost:3000").replace(/\/$/, "")}/api/auth/${path}`;
  }

  async signIn() {
    const code = process.env.NB_HUB_DEV_VERIFICATION_CODE;
    if (!code) throw new Error("E2E login requires NB_HUB_DEV_VERIFICATION_CODE in an explicitly started development API");
    const email = `e2e-${randomUUID()}@example.com`;
    const sent = await this.request.post(this.authURL("send-code"), { data: { email } });
    if (!sent.ok()) throw new Error(`Send code failed (${sent.status()}): ${await sent.text()}`);
    const login = await this.request.post(this.authURL("verify-code"), { data: { email, code } });
    if (!login.ok()) throw new Error(`Login failed (${login.status()}): ${await login.text()}`);
    return email;
  }

  async logout() {
    const state = await this.request.storageState();
    const csrf = state.cookies.find((cookie) => cookie.name === "nbhub_csrf")?.value;
    return this.request.post(this.authURL("logout"), { headers: csrf ? { "X-CSRF-Token": csrf } : {} });
  }
}

export const test = base.extend<{ api: TestApiClient }>({
  api: async ({ context }, use) => {
    const api = new TestApiClient(context.request);
    await use(api);
    await api.logout();
  },
});

export { expect } from "@playwright/test";
