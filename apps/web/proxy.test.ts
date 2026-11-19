// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, proxy } from "./proxy";

afterEach(() => vi.unstubAllEnvs());

it.each(["/api", "/api/auth/me", "/api/health", "/api/daemon/ws"])("runs the proxy for %s", (url) =>
  expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true),
);

it.each(["/", "/login", "/_next/static/app.js"])("leaves %s alone", (url) => {
  expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
});

it.each([
  "/api",
  "/api/daemon/ws",
  "/api/auth/../../daemon/ws",
  "/api/auth/%2e%2e%2fdaemon/ws",
  "/api/auth/%64aemon",
  "/api/health/extra",
  "/api/unknown",
])("refuses unsafe or unsupported paths: %s", (path) => {
  const response = proxy(new NextRequest(`http://localhost${path}`));
  expect(response.status).toBe(404);
  expect(response.headers.has("x-middleware-rewrite")).toBe(false);
});

it.each(["/api/auth/me", "/api/auth/google/callback", "/api/health"])(
  "rewrites %s with the query to the runtime API origin",
  (path) => {
    vi.stubEnv("NB_HUB_API_URL", "http://backend:8080");
    const request = new NextRequest(`http://localhost${path}?code=abc&next=%2F`);
    expect(proxy(request).headers.get("x-middleware-rewrite")).toBe(
      `http://backend:8080${path}?code=abc&next=%2F`,
    );
    vi.stubEnv("NB_HUB_API_URL", "http://other-backend:9090");
    expect(proxy(request).headers.get("x-middleware-rewrite")).toBe(
      `http://other-backend:9090${path}?code=abc&next=%2F`,
    );
  },
);

it("uses the loopback default only in development", () => {
  vi.stubEnv("NB_HUB_API_URL", "");
  vi.stubEnv("NODE_ENV", "development");
  const request = new NextRequest("http://localhost/api/health");
  expect(proxy(request).headers.get("x-middleware-rewrite")).toBe(
    "http://127.0.0.1:8080/api/health",
  );
  vi.stubEnv("NODE_ENV", "production");
  expect(proxy(request).headers.has("x-middleware-rewrite")).toBe(false);
});

it("forwards authentication headers without consuming the POST body", async () => {
  vi.stubEnv("NB_HUB_API_URL", "http://backend:8080");
  const request = new NextRequest("http://localhost/api/auth/verify-code", {
    method: "POST",
    body: '{"code":"888888"}',
    headers: {
      "content-type": "application/json",
      cookie: "nbhub_auth=jwt",
      "x-csrf-token": "csrf",
      authorization: "Bearer token",
      "x-auth-mode": "bearer",
      origin: "http://localhost",
      "x-user-id": "forged",
    },
  });
  const response = proxy(request);
  for (const name of [
    "content-type",
    "cookie",
    "x-csrf-token",
    "authorization",
    "x-auth-mode",
    "origin",
  ]) {
    expect(response.headers.get(`x-middleware-request-${name}`)).toBe(request.headers.get(name));
  }
  expect(response.headers.get("x-middleware-override-headers")).not.toContain("x-user-id");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(request.bodyUsed).toBe(false);
  expect(await request.text()).toBe('{"code":"888888"}');
});
