"use client";

import { useQuery } from "@tanstack/react-query";
import { healthOptions } from "@nb-hub/core/health";
import { createApiClient } from "@nb-hub/core/api";
import { Button } from "@nb-hub/ui/button";

export function HomeView({ apiUrl }: { apiUrl: string }) {
  const { data, error, isPending, refetch } = useQuery(
    healthOptions(createApiClient(apiUrl)),
  );

  return (
    <main style={{ maxWidth: 760, margin: "64px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>nb-hub</h1>
      <p>Web and desktop share this view. Each app supplies its API address.</p>
      <p role="status">
        API: {isPending ? "Connecting…" : error ? `Unavailable: ${error.message}` : data?.status}
      </p>
      <Button onClick={() => void refetch()}>Check again</Button>
    </main>
  );
}
