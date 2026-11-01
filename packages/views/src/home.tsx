"use client";

import { useQuery } from "@tanstack/react-query";
import { healthOptions } from "@nb-hub/core/health";
import { createApiClient } from "@nb-hub/core/api";
import { Button } from "@nb-hub/ui/button";
import { Refresh } from "@nb-hub/ui/icons";

export function HomeView({ apiUrl }: { apiUrl: string }) {
  const { data, error, isPending, refetch } = useQuery(
    healthOptions(createApiClient(apiUrl)),
  );

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">nb-hub</h1>
      <p className="text-muted-foreground">Web and desktop share this view. Each app supplies its API address.</p>
      <p role="status" className={error ? "text-destructive" : "text-foreground"}>
        API: {isPending ? "Connecting…" : error ? `Unavailable: ${error.message}` : data?.status}
      </p>
      <Button onClick={() => void refetch()}>
        <Refresh data-icon="inline-start" />
        Check again
      </Button>
    </main>
  );
}
