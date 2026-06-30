import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey, normalizeApiKeyScopes } from "@/lib/api-key";

describe("api key utilities", () => {
  it("generates a prefixed key and only stores a sha256 hash", () => {
    const generated = generateApiKey();

    expect(generated.key).toMatch(/^si_live_[a-f0-9]{64}$/);
    expect(generated.prefix).toBe(generated.key.substring(0, 12));
    expect(generated.hash).toBe(hashApiKey(generated.key));
    expect(generated.hash).toHaveLength(64);
    expect(generated.hash).not.toContain(generated.key);
  });

  it("keeps only supported scopes", () => {
    expect(normalizeApiKeyScopes(["meetings:read", "admin:access", "dictionaries:write"])).toEqual([
      "meetings:read",
      "dictionaries:write",
    ]);
  });
});
