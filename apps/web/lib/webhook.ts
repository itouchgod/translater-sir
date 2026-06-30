import "server-only";

import type { Webhook } from "@prisma/client";
import { db } from "@/lib/db";
import { generateWebhookSecret, signWebhookPayload } from "@/lib/webhook-signing";

export type WebhookEvent =
  | "meeting.started"
  | "meeting.ended"
  | "meeting.summary.ready"
  | "export.ready"
  | "webhook.test";

export const WEBHOOK_EVENTS = [
  "meeting.started",
  "meeting.ended",
  "meeting.summary.ready",
  "export.ready",
] as const satisfies readonly WebhookEvent[];

const WEBHOOK_TIMEOUT_MS = 5_000;
const WEBHOOK_RETRY_DELAYS_MS = [5_000, 30_000, 5 * 60_000] as const;
const WEBHOOK_DELIVERY_RETENTION_DAYS = 30;

type WebhookPayload = {
  event: WebhookEvent;
  timestamp: string;
  data: unknown;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPayload(event: WebhookEvent, data: unknown) {
  return {
    event,
    timestamp: new Date().toISOString(),
    data,
  } satisfies WebhookPayload;
}

async function postWebhook(webhook: Webhook, event: WebhookEvent, data: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  const payload = JSON.stringify(buildPayload(event, data));
  const signature = signWebhookPayload(webhook.secret, payload);
  const startedAt = Date.now();

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": `sha256=${signature}`,
        "X-Event": event,
      },
      body: payload,
      signal: controller.signal,
    });

    return {
      ok: response.ok,
      statusCode: response.status,
      latencyMs: Date.now() - startedAt,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: null,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Webhook request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function recordDelivery(params: {
  webhook: Webhook;
  event: WebhookEvent;
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
}) {
  const retentionCutoff = new Date(Date.now() - WEBHOOK_DELIVERY_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  await db.$transaction([
    db.webhookDelivery.create({
      data: {
        webhookId: params.webhook.id,
        organizationId: params.webhook.organizationId,
        targetUrl: params.webhook.url,
        event: params.event,
        statusCode: params.statusCode,
        latencyMs: params.latencyMs,
        error: params.error,
      },
    }),
    db.webhookDelivery.deleteMany({
      where: {
        createdAt: {
          lt: retentionCutoff,
        },
      },
    }),
  ]);
}

export async function sendWebhook(webhook: Webhook, event: WebhookEvent, data: unknown) {
  let latestResult: Awaited<ReturnType<typeof postWebhook>> | null = null;

  for (let attempt = 0; attempt <= WEBHOOK_RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) {
      await sleep(WEBHOOK_RETRY_DELAYS_MS[attempt - 1] ?? WEBHOOK_RETRY_DELAYS_MS.at(-1)!);
    }

    latestResult = await postWebhook(webhook, event, data);

    if (latestResult.ok) {
      break;
    }
  }

  if (!latestResult) {
    return;
  }

  await recordDelivery({
    webhook,
    event,
    statusCode: latestResult.statusCode,
    latencyMs: latestResult.latencyMs,
    error: latestResult.error,
  });
}

export async function sendWebhookOnce(webhook: Webhook, event: WebhookEvent, data: unknown) {
  const result = await postWebhook(webhook, event, data);

  await recordDelivery({
    webhook,
    event,
    statusCode: result.statusCode,
    latencyMs: result.latencyMs,
    error: result.error,
  });

  return result;
}

export { generateWebhookSecret, signWebhookPayload };
