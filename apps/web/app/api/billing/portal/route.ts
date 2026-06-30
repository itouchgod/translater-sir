import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requirePermission } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { AppError, ValidationError } from "@/lib/errors";
import { getAppUrl, getStripeServer } from "@/lib/stripe";

export const runtime = "nodejs";

export const POST = withApiHandler(async function POST() {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    throw new ValidationError("请先加入或创建组织");
  }

  await requirePermission(organizationId, "billing:manage");

  const subscription = await db.subscription.findFirst({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    select: {
      stripeCustomerId: true,
    },
  });

  if (!subscription?.stripeCustomerId) {
    throw new AppError("STRIPE_CUSTOMER_NOT_FOUND", "当前组织还没有可管理的 Stripe 客户信息", 404);
  }

  const stripe = getStripeServer();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${getAppUrl()}/billing`,
  });

  return apiSuccess({
    url: portalSession.url,
  });
});
