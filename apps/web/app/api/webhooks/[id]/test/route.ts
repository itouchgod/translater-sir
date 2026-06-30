import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requirePermission } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { sendWebhookOnce } from "@/lib/webhook";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export const runtime = "nodejs";

export const POST = withApiHandler(async function POST(_request: Request, context: RouteContext) {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;
  const { id } = await context.params;

  if (!organizationId) {
    throw new ValidationError("请先加入或创建组织");
  }

  await requirePermission(organizationId, "webhook:manage");

  const webhook = await db.webhook.findFirst({
    where: {
      id,
      organizationId,
    },
  });

  if (!webhook) {
    throw new NotFoundError("Webhook 不存在");
  }

  const result = await sendWebhookOnce(webhook, "webhook.test", {
    test: true,
    webhookId: webhook.id,
  });

  return apiSuccess(result);
});
