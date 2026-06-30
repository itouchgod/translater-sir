import { describe, expect, it } from "vitest";
import { getRequestId } from "@/lib/logger";
import { getAuditRequestContext } from "@/utils/audit";

describe("audit and request logging utilities", () => {
  it("extracts the first forwarded IP and user agent", () => {
    const request = new Request("https://example.com/api/test", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        "user-agent": "vitest",
      },
    });

    expect(getAuditRequestContext(request)).toEqual({
      ip: "203.0.113.10",
      userAgent: "vitest",
    });
  });

  it("uses x-request-id when present", () => {
    const request = new Request("https://example.com/api/test", {
      headers: {
        "x-request-id": "req_123",
      },
    });

    expect(getRequestId(request)).toBe("req_123");
  });
});
