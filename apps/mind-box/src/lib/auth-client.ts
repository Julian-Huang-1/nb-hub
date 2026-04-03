import { createAuthClient } from "better-auth/react";
import { getApiBase } from "../env";

const apiBase = getApiBase();
const baseURL = apiBase ? `${apiBase}/auth` : undefined;

export const authClient = createAuthClient({
  baseURL,
});
