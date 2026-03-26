import type { ApiError, ApiSuccess } from "@nb-hub/contracts";
import { getApiBase } from "../env.js";

export class ApiHttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.body = body;
  }
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();
  if (!base) {
    throw new Error("VITE_API_BASE_URL is not set");
  }

  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...init,
    credentials: init?.credentials ?? "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const json: unknown = await response.json();
  if (!response.ok) {
    throw new ApiHttpError(`HTTP ${response.status}`, response.status, json);
  }
  return json as T;
}

export async function apiOkData<T>(path: string, init?: RequestInit): Promise<T> {
  const json = await apiJson<ApiSuccess<T> | ApiError>(path, init);
  if (json.status === "error") {
    throw new Error(json.message);
  }
  return json.data;
}
