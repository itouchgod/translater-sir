import { describe, expect, it } from "vitest";
import { getRateLimitHeaders } from "@/lib/with-rate-limit";
import { validateMagicBytes, validateUpload } from "@/utils/upload-validation";

describe("security hardening utilities", () => {
  it("validates image magic bytes", () => {
    expect(validateMagicBytes("image/jpeg", "ffd8ffe000104a4649460001")).toEqual({
      valid: true,
      error: null,
    });
    expect(validateMagicBytes("image/png", "89504e470d0a1a0a0000000d")).toEqual({
      valid: true,
      error: null,
    });
    expect(validateMagicBytes("image/webp", "52494646aabbccdd57454250")).toEqual({
      valid: true,
      error: null,
    });
    expect(validateMagicBytes("image/png", "ffd8ffe000104a4649460001")).toEqual({
      valid: false,
      error: "文件内容与类型不匹配",
    });
  });

  it("requires magic bytes for image uploads", () => {
    expect(validateUpload({ type: "image/png", size: 1024 }, ["image/png"], 2048)).toEqual({
      valid: false,
      error: "缺少文件签名信息",
    });
  });

  it("builds integer retry-after headers for 429 responses", () => {
    const headers = getRateLimitHeaders("api:meeting:create", {
      success: false,
      remaining: 0,
      resetAt: 1_800_000_000,
      retryAfter: 42,
    });

    expect(headers.get("X-RateLimit-Limit")).toBe("10");
    expect(headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(headers.get("X-RateLimit-Reset")).toBe("1800000000");
    expect(headers.get("Retry-After")).toBe("42");
  });
});
