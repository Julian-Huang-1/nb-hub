// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it.each([["daemon", "ws"], ["auth", "..", "daemon", "ws"], ["auth", "../daemon"]])("refuses unsafe proxy paths: %j", async (...path: string[]) => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const result = await GET(new NextRequest("http://localhost/api/auth/me"), { params: Promise.resolve({ path }) });
  expect(result.status).toBe(404); expect(fetch).not.toHaveBeenCalled();
});
it("forwards authentication headers and preserves both cookie headers", async () => {
  vi.stubEnv("NB_HUB_API_URL", "http://127.0.0.1:8080");
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", "nbhub_auth=jwt; HttpOnly; Path=/");
  headers.append("Set-Cookie", "nbhub_csrf=csrf; Path=/");
  const fetch = vi.fn().mockResolvedValue(new Response('{"user":{}}', { headers })); vi.stubGlobal("fetch", fetch);
  const request = new NextRequest("http://localhost/api/auth/me", { headers: { cookie: "nbhub_auth=jwt", "x-csrf-token": "csrf", "x-user-id": "forged" } });
  const result = await GET(request, { params: Promise.resolve({ path: ["auth", "me"] }) });
  expect(result.headers.getSetCookie()).toHaveLength(2);
  const forwarded = fetch.mock.calls[0][1].headers as Headers;
  expect(forwarded.get("cookie")).toBe("nbhub_auth=jwt"); expect(forwarded.has("x-user-id")).toBe(false);
});
it("bounds request bodies before forwarding", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const result = await POST(new NextRequest("http://localhost/api/auth/verify-code", { method: "POST", body: "x".repeat(8193) }), { params: Promise.resolve({ path: ["auth", "verify-code"] }) });
  expect(result.status).toBe(413); expect(fetch).not.toHaveBeenCalled();
});
