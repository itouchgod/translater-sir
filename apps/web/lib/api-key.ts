import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

export const API_KEY_PREFIX = "si_live";

export const API_KEY_SCOPES = [
  "meetings:read",
  "meetings:write",
  "segments:read",
  "dictionaries:read",
  "dictionaries:write",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const ApiKeyScopeSchema = z.enum(API_KEY_SCOPES);

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `${API_KEY_PREFIX}_${randomBytes(32).toString("hex")}`;

  return {
    key,
    hash: hashApiKey(key),
    prefix: key.substring(0, 12),
  };
}

export function isApiKeyScope(value: string): value is ApiKeyScope {
  return API_KEY_SCOPES.includes(value as ApiKeyScope);
}

export function normalizeApiKeyScopes(scopes: string[]) {
  return scopes.filter(isApiKeyScope);
}
