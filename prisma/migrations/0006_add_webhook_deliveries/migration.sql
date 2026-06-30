CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "statusCode" INTEGER,
    "latencyMs" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WebhookDelivery_webhookId_fkey'
  ) THEN
    ALTER TABLE "WebhookDelivery"
      ADD CONSTRAINT "WebhookDelivery_webhookId_fkey"
      FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WebhookDelivery_organizationId_fkey'
  ) THEN
    ALTER TABLE "WebhookDelivery"
      ADD CONSTRAINT "WebhookDelivery_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "WebhookDelivery_webhookId_createdAt_idx"
  ON "WebhookDelivery"("webhookId", "createdAt");

CREATE INDEX IF NOT EXISTS "WebhookDelivery_organizationId_createdAt_idx"
  ON "WebhookDelivery"("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "WebhookDelivery_createdAt_idx"
  ON "WebhookDelivery"("createdAt");
