import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requirePermission } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { getCurrentUsage } from "@/lib/quota";
import { PLANS } from "@/lib/stripe";
import { withRedisCache } from "@/utils/redis-helpers";
import { RedisKeys } from "@/utils/redis-keys";
import { RedisTTL } from "@/utils/redis-ttl";

export const GET = withApiHandler(async function GET() {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    throw new ValidationError("请先加入或创建组织");
  }

  await requirePermission(organizationId, "billing:view");

  const current = await withRedisCache(
    RedisKeys.billingCurrent(organizationId),
    RedisTTL.BILLING_CURRENT,
    async () => {
      const [organization, subscription, usage] = await Promise.all([
        db.organization.findUniqueOrThrow({
          where: { id: organizationId },
          select: {
            id: true,
            name: true,
            plan: true,
          },
        }),
        db.subscription.findFirst({
          where: { organizationId },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            stripePriceId: true,
            status: true,
            plan: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
          },
        }),
        getCurrentUsage(organizationId),
      ]);

      return {
        organization,
        subscription: subscription
          ? {
              ...subscription,
              currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
              currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
            }
          : null,
        usage,
        currentPlan: PLANS[organization.plan],
        plans: PLANS,
      };
    },
  );

  return apiSuccess(current);
});
