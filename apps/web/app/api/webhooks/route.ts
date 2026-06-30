import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requirePermission } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { generateWebhookSecret, WEBHOOK_EVENTS } from "@/lib/webhook";

const WebhookEventSchema = z.enum(WEBHOOK_EVENTS);

const CreateWebhookSchema = z.object({
  url: z.string().url("Webhook URL 无效").max(2048),
  events: z.array(WebhookEventSchema).min(1, "至少选择一个事件"),
  isActive: z.boolean().default(true),
});

export const runtime = "nodejs";

export const GET = withApiHandler(async function GET() {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    throw new ValidationError("请先加入或创建组织");
  }

  await requirePermission(organizationId, "webhook:manage");

  const webhooks = await db.webhook.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          event: true,
          statusCode: true,
          latencyMs: true,
          error: true,
          createdAt: true,
        },
      },
    },
  });

  return apiSuccess({ items: webhooks });
});

export const POST = withApiHandler(async function POST(request: Request) {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    throw new ValidationError("请先加入或创建组织");
  }

  await requirePermission(organizationId, "webhook:manage");

  const parsed = CreateWebhookSchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Webhook 信息无效");
  }

  const secret = generateWebhookSecret();
  const webhook = await db.webhook.create({
    data: {
      organizationId,
      url: parsed.data.url,
      events: parsed.data.events,
      isActive: parsed.data.isActive,
      secret,
    },
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return apiSuccess(
    {
      webhook,
      secret,
    },
    { status: 201 },
  );
});
