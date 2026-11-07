"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthError, type AuthClient, type AuthSession } from "@nb-hub/core/auth";
import { Button } from "@nb-hub/ui/button";
import { Input } from "@nb-hub/ui/components/input";
import { HomeView } from "./home";

function message(error: unknown) { return error instanceof Error ? error.message : "Request failed"; }
const accountKey = ["auth", "me"] as const;

export function AccountView({ client, apiUrl, initialError }: { client: AuthClient; apiUrl: string; initialError?: string }) {
  const cache = useQueryClient();
  const me = useQuery({ queryKey: accountKey, queryFn: client.me, retry: false, staleTime: 30_000 });
  const renewal = useMutation({ mutationFn: client.refresh, onError: (error) => { if (error instanceof AuthError && error.status === 401) cache.setQueryData(accountKey, null); } });
  const renew = renewal.mutateAsync;
  useEffect(() => {
    if (!me.data || me.data.kind !== "session") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const result = await renew();
        if (!cancelled) timer = setTimeout(() => void refresh(), result.check_again_in_seconds * 1000);
      } catch { if (!cancelled) timer = setTimeout(() => void refresh(), 60_000); }
    }
    const unsubscribe = client.subscribeActivity(() => { clearTimeout(timer); void refresh(); });
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); unsubscribe(); };
  }, [client, me.data?.user.id, renew]);
  if (me.isPending) return <main className="mx-auto max-w-md px-6 py-16" role="status">Checking session…</main>;
  if (!me.data && me.error && (!(me.error instanceof AuthError) || me.error.status !== 401)) {
    return <main className="mx-auto max-w-md space-y-4 px-6 py-16"><h1 className="text-2xl font-semibold">nb-hub</h1><p role="alert" className="text-destructive">{message(me.error)}</p><Button onClick={() => void me.refetch()}>Retry</Button></main>;
  }
  if (!me.data) return <LoginForm client={client} initialError={initialError} onLogin={() => { void cache.invalidateQueries({ queryKey: accountKey }); }} />;
  return <SignedIn client={client} session={me.data} apiUrl={apiUrl} onLogout={() => { cache.setQueryData(accountKey, null); cache.removeQueries({ predicate: (query) => query.queryKey[0] !== "auth" || query.queryKey[1] !== "me" }); cache.getMutationCache().clear(); }} />;
}

function LoginForm({ client, initialError, onLogin }: { client: AuthClient; initialError?: string; onLogin(): void }) {
  const config = useQuery({ queryKey: ["auth", "config"], queryFn: client.config, retry: false });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const sending = useMutation({ mutationFn: () => client.sendCode(email), onSuccess: () => { setSentTo(email); setCooldown(60); } });
  const login = useMutation({ mutationFn: () => client.verifyCode(email, code), onSuccess: onLogin });
  useEffect(() => { if (!cooldown) return; const timeout = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(timeout); }, [cooldown]);
  function submit(event: FormEvent) { event.preventDefault(); login.mutate(); }
  return <main className="mx-auto max-w-md space-y-6 px-6 py-16">
    <h1 className="text-2xl font-semibold tracking-tight">Sign in to nb-hub</h1>
    {config.isPending ? <p role="status">Loading sign-in options…</p> : config.data?.email_login ? <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-2"><span>Email</span><Input type="email" autoComplete="email" required value={email} onChange={(event) => { setEmail(event.target.value); setSentTo(""); }} /></label>
      <Button type="button" variant="outline" disabled={!email || sending.isPending || cooldown > 0} onClick={() => sending.mutate()}>{sending.isPending ? "Sending…" : cooldown ? `Send again in ${cooldown}s` : "Send code"}</Button>
      {sentTo && <p role="status" className="text-muted-foreground">Code sent to {sentTo}</p>}
      <label className="block space-y-2"><span>Verification code</span><Input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value)} /></label>
      <Button type="submit" disabled={login.isPending || code.length !== 6}>{login.isPending ? "Signing in…" : "Sign in"}</Button>
    </form> : config.data && <p className="text-muted-foreground">Email sign-in is not configured.</p>}
    {client.mode === "cookie" && config.data?.google_login && <Button variant="outline" nativeButton={false} render={<a href={client.googleLoginURL()} />}>Continue with Google</Button>}
    {(login.error || sending.error || config.error || initialError) && <p role="alert" className="text-destructive">{message(login.error || sending.error || config.error || new Error(initialError))}</p>}
  </main>;
}

function SignedIn({ client, session, apiUrl, onLogout }: { client: AuthClient; session: AuthSession; apiUrl: string; onLogout(): void }) {
  const cache = useQueryClient();
  const [name, setName] = useState("");
  const [days, setDays] = useState("90");
  const [createdToken, setCreatedToken] = useState("");
  const interactive = session.kind === "session";
  const tokens = useQuery({ queryKey: ["auth", "tokens"], queryFn: client.tokens, enabled: interactive });
  const sessions = useQuery({ queryKey: ["auth", "sessions"], queryFn: client.sessions, enabled: interactive });
  const logout = useMutation({ mutationFn: client.logout, onSuccess: onLogout, onError: (error) => { if (error instanceof AuthError && error.status === 401) onLogout(); } });
  const create = useMutation({ mutationFn: () => client.createToken(name, Number(days)), onSuccess: (result) => { setCreatedToken(result.token); setName(""); void cache.invalidateQueries({ queryKey: ["auth", "tokens"] }); } });
  const revoke = useMutation({ mutationFn: client.revokeToken, onSuccess: () => void cache.invalidateQueries({ queryKey: ["auth", "tokens"] }) });
  const revokeSession = useMutation({ mutationFn: client.revokeSession, onSuccess: (_, id) => { if (id === session.session_id) onLogout(); else void cache.invalidateQueries({ queryKey: ["auth", "sessions"] }); } });
  const error = logout.error || create.error || revoke.error || revokeSession.error || tokens.error || sessions.error;
  return <>
    <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 pt-8"><span>{session.user.email}</span><Button variant="outline" disabled={logout.isPending} onClick={() => logout.mutate()}>Sign out</Button></header>
    <HomeView apiUrl={apiUrl} />
    {interactive && <section className="mx-auto max-w-3xl space-y-6 px-6 pb-16">
      <h2 className="text-xl font-semibold">Personal access tokens</h2>
      <p className="text-muted-foreground">Tokens access your account API. Keep them private; the full value is shown only once.</p>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
        <label className="space-y-2"><span className="block">Token name</span><Input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="space-y-2"><span className="block">Expires in days</span><Input type="number" required min={1} max={365} value={days} onChange={(event) => setDays(event.target.value)} /></label>
        <Button type="submit" disabled={create.isPending || !name.trim()}>Create token</Button>
      </form>
      {createdToken && <div className="space-y-2 rounded-lg border border-border p-4"><label className="block space-y-2"><span>New token — save it now</span><Input aria-label="New personal access token" readOnly value={createdToken} /></label><Button variant="outline" onClick={() => setCreatedToken("")}>Dismiss token</Button></div>}
      <ul className="space-y-3">{tokens.data?.map((token) => <li key={token.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"><div><p>{token.name}</p><p className="text-muted-foreground">{token.token_prefix}… · expires {new Date(token.expires_at).toLocaleDateString()}</p></div><Button variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate(token.id)} aria-label={`Revoke token ${token.name}`}>Revoke</Button></li>)}</ul>
      <h2 className="text-xl font-semibold">Active sessions</h2>
      <ul className="space-y-3">{sessions.data?.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"><div className="min-w-0"><p>{item.id === session.session_id ? "This session" : "Other session"}</p><p className="truncate text-muted-foreground">{item.user_agent || "Unknown client"}</p></div><Button variant="outline" disabled={revokeSession.isPending} onClick={() => revokeSession.mutate(item.id)} aria-label={item.id === session.session_id ? "End this session" : `End session ${item.id}`}>End session</Button></li>)}</ul>
    </section>}
    {error && <p role="alert" className="mx-auto max-w-3xl px-6 pb-8 text-destructive">{message(error)}</p>}
  </>;
}
