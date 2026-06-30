import "server-only";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendWebhook, type WebhookEvent } from "@/lib/webhook";

export function triggerWebhooks(orgId: string, event: WebhookEvent, data: unknown): Promise<void> {
  void (async () => {
    const webhooks = await db.webhook.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        events: {
          has: event,
        },
      },
    });

    await Promise.all(webhooks.map((webhook) => sendWebhook(webhook, event, data)));
  })().catch((error) => {
    logger.warn({ error, orgId, event }, "Failed to trigger webhooks");
  });

  return Promise.resolve();
}
