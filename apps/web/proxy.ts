import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // The local-only daemon endpoint must never be reached through this proxy.
  if (!/^\/api\/(?:health|auth(?:\/[a-zA-Z0-9_-]+)*)$/.test(pathname)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const origin =
    process.env.NB_HUB_API_URL?.trim() ||
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8080" : undefined);
  if (!origin) return NextResponse.next();

  const target = new URL(`${pathname}${search}`, origin);
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
  const response = NextResponse.rewrite(target, { request: { headers } });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
