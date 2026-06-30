import { Plan } from "@prisma/client";
import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requirePermission } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { AppError, ValidationError } from "@/lib/errors";
import { getAppUrl, getStripeServer, PLANS } from "@/lib/stripe";
import { auditLog } from "@/utils/audit";

const CheckoutSchema = z.object({
  plan: z.enum([Plan.STARTER, Plan.PROFESSIONAL]),
});

export const runtime = "nodejs";

export const POST = withApiHandler(async function POST(request: Request) {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    throw new ValidationError("请先加入或创建组织");
  }

  await requirePermission(organizationId, "billing:manage");

  const parsed = CheckoutSchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "订阅计划无效");
  }

  const planConfig = PLANS[parsed.data.plan];

  if (!planConfig.stripePriceId) {
    throw new AppError("BILLING_PRICE_NOT_CONFIGURED", "该订阅计划暂未配置 Stripe Price ID", 503);
  }

  const [organization, subscription] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
      },
    }),
    db.subscription.findFirst({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      select: {
        stripeCustomerId: true,
      },
    }),
  ]);

  const stripe = getStripeServer();
  const appUrl = getAppUrl();
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: organization.id,
    customer: subscription?.stripeCustomerId ?? undefined,
    customer_email: subscription?.stripeCustomerId ? undefined : session.user.email ?? undefined,
    line_items: [
      {
        price: planConfig.stripePriceId,
        quantity: 1,
      },
    ],
    metadata: {
      organizationId: organization.id,
      plan: parsed.data.plan,
    },
    subscription_data: {
      metadata: {
        organizationId: organization.id,
        plan: parsed.data.plan,
      },
    },
    allow_promotion_codes: true,
    success_url: `${appUrl}/billing?checkout=success`,
    cancel_url: `${appUrl}/billing/plans?checkout=cancelled`,
  });

  if (!checkoutSession.url) {
    throw new AppError("CHECKOUT_SESSION_ERROR", "无法创建订阅支付链接，请稍后重试", 502);
  }
  void auditLog({
    userId: session.user.id,
    action: "billing.subscribe",
    resource: "Subscription",
    metadata: {
      organizationId,
      plan: parsed.data.plan,
      stripePriceId: planConfig.stripePriceId,
      checkoutSessionId: checkoutSession.id,
    },
    request,
  });

  return apiSuccess({
    url: checkoutSession.url,
  });
});
