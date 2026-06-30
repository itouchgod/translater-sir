import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateWebhookSecret, signWebhookPayload } from "@/lib/webhook-signing";

describe("webhook utilities", () => {
  it("generates a one-time secret", () => {
    expect(generateWebhookSecret()).toMatch(/^whsec_[a-f0-9]{64}$/);
  });

  it("signs payloads with hmac sha256", () => {
    const secret = "whsec_test";
    const payload = JSON.stringify({ event: "meeting.started", timestamp: "2026-06-29T00:00:00.000Z" });
    const expected = createHmac("sha256", secret).update(payload).digest("hex");

    expect(signWebhookPayload(secret, payload)).toBe(expected);
  });
});
