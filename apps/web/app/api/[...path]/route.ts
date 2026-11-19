import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  // The unauthenticated daemon endpoint must not become remotely accessible
  // through a loopback request from this development proxy.
  if (
    path.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part)) ||
    (path[0] !== "auth" && path.join("/") !== "health")
  )
    return new Response("Not found", { status: 404 });
  const origin = process.env.NB_HUB_API_URL ?? "http://127.0.0.1:8080";
  const target = new URL(
    `/api/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`,
    origin,
  );
  const headers = new Headers();
  for (const name of [
    "content-type",
    "authorization",
    "cookie",
    "x-csrf-token",
    "x-auth-mode",
    "origin",
    "user-agent",
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    let body: string | undefined;
    if (request.body && request.method !== "GET" && request.method !== "HEAD") {
      const reader = request.body.getReader();
      const decoder = new TextDecoder();
      let size = 0;
      body = "";
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 8192) {
            await reader.cancel();
            return new Response("Request body too large", { status: 413 });
          }
          body += decoder.decode(chunk.value, { stream: true });
        }
        body += decoder.decode();
      } finally {
        reader.releaseLock();
      }
    }
    const response = await fetch(target, {
      method: request.method,
      headers,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      ...(body === undefined ? {} : { body }),
    });
    const outgoing = new Headers({ "Cache-Control": "no-store" });
    for (const name of ["content-type", "location", "retry-after"]) {
      const value = response.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    for (const cookie of response.headers.getSetCookie()) outgoing.append("set-cookie", cookie);
    return new Response(response.body, { status: response.status, headers: outgoing });
  } catch {
    return Response.json({ code: "api_unavailable", error: "API is unavailable" }, { status: 502 });
  }
}
export { forward as GET, forward as POST, forward as DELETE, forward as OPTIONS };
