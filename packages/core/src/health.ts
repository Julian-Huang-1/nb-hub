import { queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "./api";

export const healthKey = ["health"] as const;

export function healthOptions(api: ApiClient) {
  return queryOptions({
    queryKey: healthKey,
    queryFn: () => api.getHealth(),
    refetchInterval: 10_000,
  });
}
