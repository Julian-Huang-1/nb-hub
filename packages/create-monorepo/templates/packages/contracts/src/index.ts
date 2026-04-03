/** Shared API types between apps and backends. */

export const CONTRACTS_PACKAGE_NAME = "{{SCOPE_CONTRACTS}}" as const;

export type ApiSuccess<T> = { status: "ok"; data: T };

export type HealthPayload = { ok: true; service: string };
