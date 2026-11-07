import { useEffect, useState } from "react";
import { AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthError, createAuthClient } from "@nb-hub/core/auth";

const api = createAuthClient(process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080", {
  mode: "bearer",
  storage: { get: () => SecureStore.getItemAsync("nbhub-session"), set: (token) => token ? SecureStore.setItemAsync("nbhub-session", token) : SecureStore.deleteItemAsync("nbhub-session") },
});
const meKey = ["mobile", "auth", "me"];
function errorText(error: unknown) { return error instanceof Error ? error.message : "Request failed"; }

export default function HomeScreen() {
  const cache = useQueryClient();
  const me = useQuery({ queryKey: meKey, queryFn: api.me, retry: false });
  const config = useQuery({ queryKey: ["mobile", "auth", "config"], queryFn: api.config });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [newToken, setNewToken] = useState("");
  const [sent, setSent] = useState(false);
  const tokens = useQuery({ queryKey: ["mobile", "auth", "tokens"], queryFn: api.tokens, enabled: Boolean(me.data) });
  const sessions = useQuery({ queryKey: ["mobile", "auth", "sessions"], queryFn: api.sessions, enabled: Boolean(me.data) });
  const send = useMutation({ mutationFn: () => api.sendCode(email), onSuccess: () => setSent(true) });
  const login = useMutation({ mutationFn: () => api.verifyCode(email, code), onSuccess: () => { setCode(""); void cache.invalidateQueries({ queryKey: meKey }); } });
  const logout = useMutation({ mutationFn: api.logout, onSuccess: reset, onError: (error) => { if (error instanceof AuthError && error.status === 401) reset(); } });
  const create = useMutation({ mutationFn: () => api.createToken(name, 90), onSuccess: (result) => { setNewToken(result.token); setName(""); void cache.invalidateQueries({ queryKey: ["mobile", "auth", "tokens"] }); } });
  const revoke = useMutation({ mutationFn: api.revokeToken, onSuccess: () => void cache.invalidateQueries({ queryKey: ["mobile", "auth", "tokens"] }) });
  const end = useMutation({ mutationFn: api.revokeSession, onSuccess: (_, id) => { if (id === me.data?.session_id) reset(); else void cache.invalidateQueries({ queryKey: ["mobile", "auth", "sessions"] }); } });
  function reset() { setNewToken(""); cache.setQueryData(meKey, null); cache.removeQueries({ predicate: (query) => query.queryKey[0] === "mobile" && query.queryKey[2] !== "me" }); cache.getMutationCache().clear(); }
  const userID = me.data?.user.id;
  useEffect(() => {
    if (!userID) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try { const value = await api.refresh(); if (!cancelled) timer = setTimeout(() => void refresh(), value.check_again_in_seconds * 1000); }
      catch (error) { if (cancelled) return; if (error instanceof AuthError && error.status === 401) cache.setQueryData(meKey, null); else timer = setTimeout(() => void refresh(), 60_000); }
    }
    void refresh();
    const listener = AppState.addEventListener("change", (state) => { if (state === "active") { clearTimeout(timer); void refresh(); } });
    return () => { cancelled = true; clearTimeout(timer); listener.remove(); };
  }, [userID, cache]);
  const error = login.error || send.error || logout.error || create.error || revoke.error || end.error || tokens.error || sessions.error;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text accessibilityRole="header" style={styles.heading}>nb-hub</Text>
    {me.isPending ? <Text>Checking session…</Text> : me.data ? <>
      <Text>{me.data.user.email}</Text><Action label="Sign out" disabled={logout.isPending} onPress={() => logout.mutate()} />
      <Text accessibilityRole="header" style={styles.section}>Personal access tokens</Text>
      <TextInput accessibilityLabel="Token name" placeholder="Token name" maxLength={80} style={styles.input} value={name} onChangeText={setName} />
      <Action label="Create token (90 days)" disabled={create.isPending || !name.trim()} onPress={() => create.mutate()} />
      {newToken && <View style={styles.card}><Text>Save this token now. It is shown only once.</Text><Text selectable>{newToken}</Text><Action label="Dismiss token" onPress={() => setNewToken("")} /></View>}
      {tokens.data?.map((token) => <View key={token.id} style={styles.card}><Text>{token.name} · {token.token_prefix}…</Text><Action label={`Revoke ${token.name}`} disabled={revoke.isPending} onPress={() => revoke.mutate(token.id)} /></View>)}
      <Text accessibilityRole="header" style={styles.section}>Active sessions</Text>
      {sessions.data?.map((session) => <View key={session.id} style={styles.card}><Text>{session.id === me.data?.session_id ? "This session" : session.user_agent || "Other session"}</Text><Action label="End session" disabled={end.isPending} onPress={() => end.mutate(session.id)} /></View>)}
    </> : me.error && (!(me.error instanceof AuthError) || me.error.status !== 401) ? <><Text accessibilityRole="alert">{errorText(me.error)}</Text><Action label="Retry" onPress={() => void me.refetch()} /></> : <>
      <Text style={styles.section}>Sign in</Text>
      {config.data?.email_login ? <>
        <TextInput accessibilityLabel="Email" placeholder="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={styles.input} value={email} onChangeText={(value) => { setEmail(value); setSent(false); }} />
        <Action label="Send code" disabled={send.isPending || !email.trim()} onPress={() => send.mutate()} />
        {sent && <Text>Verification code sent</Text>}
        <TextInput accessibilityLabel="Verification code" placeholder="Verification code" keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" style={styles.input} value={code} onChangeText={setCode} />
        <Action label="Sign in" disabled={login.isPending || code.length !== 6} onPress={() => login.mutate()} />
      </> : <Text>{config.isPending ? "Loading sign-in options…" : config.error ? errorText(config.error) : "Email sign-in is not configured."}</Text>}
    </>}
    {error && <Text accessibilityRole="alert">{errorText(error)}</Text>}
  </ScrollView></SafeAreaView>;
}
function Action({ label, onPress, disabled = false }: { label: string; onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" }, content: { padding: 24, gap: 16 }, heading: { fontSize: 32, fontWeight: "700" }, section: { fontSize: 20, fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#94a3b8", borderRadius: 8, padding: 12, color: "#111827" }, card: { borderWidth: 1, borderColor: "#cbd5e1", padding: 12, borderRadius: 8, gap: 8 },
  button: { backgroundColor: "#111827", borderRadius: 8, padding: 14, alignSelf: "flex-start" }, buttonText: { color: "white", fontWeight: "600" }, disabled: { opacity: 0.5 },
});
