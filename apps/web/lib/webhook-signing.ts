import { createHmac, randomBytes } from "node:crypto";

export function generateWebhookSecret() {
  return `whsec_${randomBytes(32).toString("hex")}`;
}

export function signWebhookPayload(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}
