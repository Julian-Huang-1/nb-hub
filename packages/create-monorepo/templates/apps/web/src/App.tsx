import { useEffect, useState } from "react";
import type { ApiSuccess, HealthPayload } from "{{SCOPE_CONTRACTS}}";

const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:9999";

export function App() {
  const [text, setText] = useState<string>("Loading…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/health`);
        const body = (await res.json()) as ApiSuccess<HealthPayload>;
        if (!cancelled) {
          setText(
            res.ok && body.status === "ok"
              ? `API: ${body.data.service} — ok`
              : `Unexpected response (${res.status})`,
          );
        }
      } catch {
        if (!cancelled) {
          setText(`Could not reach API at ${apiBase} (start the backend with pnpm --filter {{SCOPE_API}} run dev)`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>{{ROOT_NAME}}</h1>
      <p>{text}</p>
    </main>
  );
}
