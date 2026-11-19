import { z } from "zod";

export interface TokenStorage {
  get(): Promise<string | null>;
  set(token: string | null): Promise<void>;
}
export interface AuthClientOptions {
  mode: "cookie" | "bearer";
  storage?: TokenStorage;
  readCookie?: (name: string) => string | null;
  subscribeActivity?: (listener: () => void) => () => void;
}
export class AuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  created_at: z.string(),
});
const loginSchema = z.object({
  user: userSchema,
  expires_at: z.string(),
  token: z.string().optional(),
});
const meSchema = z.object({
  user: userSchema,
  expires_at: z.string(),
  kind: z.enum(["session", "pat"]),
  session_id: z.string().uuid(),
});
const configSchema = z.object({
  email_login: z.boolean(),
  google_login: z.boolean(),
  signup_enabled: z.boolean(),
});
const sessionSchema = z.object({
  id: z.string().uuid(),
  user_agent: z.string(),
  created_at: z.string(),
  expires_at: z.string(),
});
const patSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  token_prefix: z.string(),
  created_at: z.string(),
  expires_at: z.string(),
});
const refreshSchema = z.object({
  token: z.string().optional(),
  expires_at: z.string(),
  renewed: z.boolean(),
  check_again_in_seconds: z.number().positive(),
});
export type AuthUser = z.infer<typeof userSchema>;
export type AuthSession = z.infer<typeof meSchema>;
export type PersonalToken = z.infer<typeof patSchema>;

export function createAuthClient(baseURL: string, options: AuthClientOptions) {
  const base = baseURL.replace(/\/$/, "");
  if (options.mode === "bearer" && !options.storage)
    throw new Error("Bearer mode requires platform token storage");
  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = { "X-Auth-Mode": options.mode };
    let sentToken: string | null = null;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (options.mode === "bearer") {
      sentToken = await options.storage!.get();
      if (sentToken) headers.Authorization = `Bearer ${sentToken}`;
    } else if (method !== "GET") {
      const csrf = options.readCookie?.("__Host-nbhub_csrf") ?? options.readCookie?.("nbhub_csrf");
      if (csrf) headers["X-CSRF-Token"] = csrf;
    }
    const response = await fetch(`${base}/api/auth/${path}`, {
      method,
      headers,
      credentials: options.mode === "cookie" ? "include" : "omit",
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const error = z
        .object({ code: z.string().optional(), error: z.string().optional() })
        .safeParse(await response.json().catch(() => null));
      if (
        response.status === 401 &&
        options.mode === "bearer" &&
        (await options.storage!.get()) === sentToken
      )
        await options.storage!.set(null);
      throw new AuthError(
        response.status,
        error.success ? (error.data.code ?? "request_failed") : "request_failed",
        error.success
          ? (error.data.error ?? "Request failed")
          : `Request failed (${response.status})`,
      );
    }
    return schema.parse(response.status === 204 ? undefined : await response.json());
  }
  return {
    mode: options.mode,
    subscribeActivity: (listener: () => void) =>
      options.subscribeActivity?.(listener) ?? (() => {}),
    config: () => request("config", configSchema),
    me: () => request("me", meSchema),
    sendCode: (email: string) =>
      request("send-code", z.object({ message: z.string() }), "POST", { email }),
    async verifyCode(email: string, code: string) {
      const result = await request("verify-code", loginSchema, "POST", { email, code });
      if (options.mode === "bearer") {
        if (!result.token) throw new Error("Server did not issue a bearer session");
        await options.storage!.set(result.token);
      }
      return result;
    },
    async refresh() {
      const result = await request("refresh", refreshSchema, "POST");
      if (options.mode === "bearer" && result.renewed && result.token)
        await options.storage!.set(result.token);
      return result;
    },
    async logout() {
      await request("logout", z.undefined(), "POST");
      if (options.mode === "bearer") await options.storage!.set(null);
    },
    sessions: () => request("sessions", z.array(sessionSchema)),
    revokeSession: (id: string) =>
      request(`sessions/${encodeURIComponent(id)}`, z.undefined(), "DELETE"),
    tokens: () => request("tokens", z.array(patSchema)),
    createToken: (name: string, days: number) =>
      request("tokens", z.object({ token: z.string(), personal_access_token: patSchema }), "POST", {
        name,
        expires_in_days: days,
      }),
    revokeToken: (id: string) =>
      request(`tokens/${encodeURIComponent(id)}`, z.undefined(), "DELETE"),
    googleLoginURL: () => `${base}/api/auth/google/start`,
  };
}
export type AuthClient = ReturnType<typeof createAuthClient>;
