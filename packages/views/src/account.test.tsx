import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, it, expect, vi } from "vitest";
import { createAuthClient } from "@nb-hub/core/auth";
import { AccountView } from "./account";

const id = "123e4567-e89b-42d3-a456-426614174000";
const user = { id, email: "test@example.com", name: "Test", created_at: "2026-11-07T00:00:00Z" };
const clients: QueryClient[] = [];
afterEach(() => { clients.splice(0).forEach((client) => client.clear()); vi.unstubAllGlobals(); });
it("signs in, creates a token shown once, and signs out through the API boundary", async () => {
  let signedIn = false;
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/me")) return signedIn ? Response.json({ user, kind: "session", expires_at: "2099-01-01T00:00:00Z", session_id: id }) : Response.json({ code: "unauthorized", error: "Sign in" }, { status: 401 });
    if (url.endsWith("/config")) return Response.json({ email_login: true, google_login: false, signup_enabled: true });
    if (url.endsWith("/send-code")) return Response.json({ message: "Sent" });
    if (url.endsWith("/verify-code")) { signedIn = true; return Response.json({ user, expires_at: "2099-01-01T00:00:00Z" }); }
    if (url.endsWith("/refresh")) return Response.json({ token: "", expires_at: "2099-01-01T00:00:00Z", renewed: false, check_again_in_seconds: 3600 });
    if (url.endsWith("/tokens")) return init?.method === "POST" ? Response.json({ token: "nbp_visible_only_once", personal_access_token: { id, name: "CLI", token_prefix: "nbp_visible", created_at: user.created_at, expires_at: "2099-01-01T00:00:00Z" } }) : Response.json([]);
    if (url.endsWith("/sessions")) return Response.json([]);
    if (url.endsWith("/logout")) { signedIn = false; return new Response(null, { status: 204 }); }
    if (url.endsWith("/health")) return Response.json({ status: "ok", service: "nb-hub-api" });
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", fetch);
  const client = createAuthClient("", { mode: "cookie", readCookie: () => "csrf" });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(queries);
  render(<QueryClientProvider client={queries}><AccountView client={client} apiUrl="" /></QueryClientProvider>);
  const actor = userEvent.setup();
  await actor.type(await screen.findByLabelText("Email"), user.email);
  await actor.click(screen.getByRole("button", { name: "Send code" }));
  expect(await screen.findByText(`Code sent to ${user.email}`)).toBeVisible();
  await actor.type(screen.getByLabelText("Verification code"), "123456");
  await actor.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByText(user.email)).toBeVisible();
  await actor.type(screen.getByLabelText("Token name"), "CLI");
  await actor.click(screen.getByRole("button", { name: "Create token" }));
  expect(await screen.findByLabelText("New personal access token")).toHaveValue("nbp_visible_only_once");
  await actor.click(screen.getByRole("button", { name: "Dismiss token" }));
  expect(screen.queryByLabelText("New personal access token")).not.toBeInTheDocument();
  await actor.click(screen.getByRole("button", { name: "Sign out" }));
  expect(await screen.findByRole("heading", { name: "Sign in to nb-hub" })).toBeVisible();
});
it("does not turn a backend outage into a logged-out state", async () => {
  const client = createAuthClient("", { mode: "cookie" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ code: "auth_unavailable", error: "Database unavailable" }, { status: 503 })));
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(queries);
  render(<QueryClientProvider client={queries}><AccountView client={client} apiUrl="" /></QueryClientProvider>);
  expect(await screen.findByRole("alert")).toHaveTextContent("Database unavailable");
  expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
});
it("preserves login form input while the session is rechecked", async () => {
  let releaseSessionCheck: (() => void) | undefined;
  let sessionChecks = 0;
  const fetch = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/me")) {
      sessionChecks += 1;
      if (sessionChecks > 1) await new Promise<void>((resolve) => { releaseSessionCheck = resolve; });
      return Response.json({ code: "unauthorized", error: "Sign in" }, { status: 401 });
    }
    if (url.endsWith("/config")) return Response.json({ email_login: true, google_login: false, signup_enabled: true });
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", fetch);
  const client = createAuthClient("", { mode: "cookie" });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(queries);
  render(<QueryClientProvider client={queries}><AccountView client={client} apiUrl="" /></QueryClientProvider>);
  const actor = userEvent.setup();
  const email = await screen.findByLabelText("Email");
  await actor.type(email, user.email);

  const recheck = queries.refetchQueries({ queryKey: ["auth", "me"] });
  expect(screen.getByLabelText("Email")).toHaveValue(user.email);
  releaseSessionCheck?.();
  await recheck;
  expect(screen.getByLabelText("Email")).toHaveValue(user.email);
});
