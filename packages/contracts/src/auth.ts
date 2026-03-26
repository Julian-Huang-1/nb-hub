import type { ApiError, IsoDateString } from "./common.js";

export type AuthUserDto = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type AuthSessionDto = {
  id: string;
  userId: string;
  token: string;
  expiresAt: IsoDateString;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type AuthSessionResponseData = {
  user: AuthUserDto;
  session: AuthSessionDto;
} | null;

export type AuthErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_CREDENTIALS"
  | "AUTH_PROVIDER_ERROR";

export type AuthApiError = ApiError & {
  code?: AuthErrorCode;
};
