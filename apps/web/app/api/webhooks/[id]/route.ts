import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requirePermission } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { WEBHOOK_EVENTS } from "@/lib/webhook";

const WebhookEventSchema = z.enum(WEBHOOK_EVENTS);

const UpdateWebhookSchema = z.object({
  url: z.string().url("Webhook URL 无效").max(2048).optional(),
  events: z.array(WebhookEventSchema).min(1, "至少选择一个事件").optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function requireWebhookAccess(id: string, organizationId: string) {
  const webhook = await db.webhook.findFirst({
    where: {
      id,
      organizationId,
    },
    select: {
      id: true,
    },
  });

  if (!webhook) {
    throw new NotFoundError("Webhook 不存在");
  }
}

export const runtime = "nodejs";

export const PATCH = withApiHandler(async function PATCH(request: Request, context: RouteContext) {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;
  const { id } = await context.params;

  if (!organizationId) {
    throw new ValidationError("请先加入或创建组织");
  }

  await requirePermission(organizationId, "webhook:manage");
  await requireWebhookAccess(id, organizationId);

  const parsed = UpdateWebhookSchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Webhook 信息无效");
  }

  const webhook = await db.webhook.update({
    where: { id },
    data: {
      ...(parsed.data.url !== undefined ? { url: parsed.data.url } : {}),
      ...(parsed.data.events !== undefined ? { events: parsed.data.events } : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
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

  return apiSuccess(webhook);
});

export const DELETE = withApiHandler(async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;
  const { id } = await context.params;

  if (!organizationId) {
    throw new ValidationError("请先加入或创建组织");
  }

  await requirePermission(organizationId, "webhook:manage");
  await requireWebhookAccess(id, organizationId);

  await db.webhook.delete({
    where: { id },
  });

  return apiSuccess({ deleted: true });
});
