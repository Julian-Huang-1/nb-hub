// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { AuthError, createAuthClient } from "./auth";

const user = { id: "123e4567-e89b-42d3-a456-426614174000", email: "test@example.com", name: "Test", created_at: "2026-11-07T00:00:00Z" };
afterEach(() => vi.unstubAllGlobals());
describe("authentication transport", () => {
  it("uses cookies and echoes CSRF for browser mutations", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ token: "nbp_test", personal_access_token: { id: user.id, name: "CLI", token_prefix: "nbp_test", created_at: user.created_at, expires_at: user.created_at } }, { status: 201 }));
    vi.stubGlobal("fetch", fetch);
    const client = createAuthClient("", { mode: "cookie", readCookie: () => "csrf-value" });
    await client.createToken("CLI", 1);
    expect(fetch).toHaveBeenCalledWith("/api/auth/tokens", expect.objectContaining({ method: "POST", credentials: "include", headers: expect.objectContaining({ "X-CSRF-Token": "csrf-value" }) }));
  });
  it("prefers the protected production CSRF cookie over sibling-domain cookies", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    const client = createAuthClient("", { mode: "cookie", readCookie: (name) => name === "__Host-nbhub_csrf" ? "protected" : "injected" });
    await client.logout();
    expect(fetch).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ headers: expect.objectContaining({ "X-CSRF-Token": "protected" }) }));
  });
  it("retains the unprefixed CSRF cookie for local development", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    const client = createAuthClient("", { mode: "cookie", readCookie: (name) => name === "nbhub_csrf" ? "local" : null });
    await client.logout();
    expect(fetch).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ headers: expect.objectContaining({ "X-CSRF-Token": "local" }) }));
  });
  it("persists and renews bearer sessions through platform storage", async () => {
    let token: string | null = null;
    const storage = { get: vi.fn(async () => token), set: vi.fn(async (value: string | null) => { token = value; }) };
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ user, token: "session-token", expires_at: user.created_at }))
      .mockResolvedValueOnce(Response.json({ token: "renewed-token", expires_at: user.created_at, renewed: true, check_again_in_seconds: 60 }));
    vi.stubGlobal("fetch", fetch);
    const client = createAuthClient("https://api.example.com", { mode: "bearer", storage });
    await client.verifyCode(user.email, "123456");
    expect(token).toBe("session-token");
    await client.refresh();
    expect(token).toBe("renewed-token");
    expect(fetch.mock.calls[1][1]).toEqual(expect.objectContaining({ credentials: "omit", headers: expect.objectContaining({ Authorization: "Bearer session-token" }) }));
  });
  it("clears rejected bearer credentials but preserves them during network failure", async () => {
    const storage = { get: vi.fn(async () => "old"), set: vi.fn(async () => {}) };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ code: "unauthorized", error: "Expired" }, { status: 401 })));
    const client = createAuthClient("", { mode: "bearer", storage });
    await expect(client.me()).rejects.toBeInstanceOf(AuthError);
    expect(storage.set).toHaveBeenCalledWith(null);
    storage.set.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network down")));
    await expect(client.logout()).rejects.toThrow("Network down");
    expect(storage.set).not.toHaveBeenCalled();
  });
  it("rejects malformed authentication responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ user: { id: "forged" } })));
    await expect(createAuthClient("", { mode: "cookie" }).me()).rejects.toThrow();
  });
});
