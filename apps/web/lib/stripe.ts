import "server-only";

import { Plan, SubscriptionStatus } from "@prisma/client";
import Stripe from "stripe";
import { invalidateBillingCurrentCache, invalidateOrganizationCache } from "@/lib/cache-invalidation";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { auditLog } from "@/utils/audit";

const STRIPE_API_VERSION = "2026-06-24.dahlia";

const globalForStripe = globalThis as unknown as {
  stripeServer?: Stripe;
};

export type BillingPlanConfig = {
  name: string;
  description: string;
  meetingsPerMonth: number;
  minutesPerMeeting: number;
  aiCallsPerMonth: number;
  membersLimit: number;
  price: number | null;
  stripePriceId: string | null;
  features: string[];
};

export const PLANS = {
  [Plan.FREE]: {
    name: "Free",
    description: "适合小团队试用实时传译流程。",
    meetingsPerMonth: 5,
    minutesPerMeeting: 30,
    aiCallsPerMonth: 100,
    membersLimit: 3,
    price: 0,
    stripePriceId: null,
    features: ["每月 5 场会议", "单场最长 30 分钟", "最多 3 名成员"],
  },
  [Plan.STARTER]: {
    name: "Starter",
    description: "适合固定频率的团队会议和客户沟通。",
    meetingsPerMonth: 50,
    minutesPerMeeting: 120,
    aiCallsPerMonth: 5000,
    membersLimit: 10,
    price: 29,
    stripePriceId: process.env.STRIPE_PRICE_ID_STARTER ?? null,
    features: ["每月 50 场会议", "单场最长 120 分钟", "最多 10 名成员"],
  },
  [Plan.PROFESSIONAL]: {
    name: "Professional",
    description: "适合高频跨语言协作和长期会议。",
    meetingsPerMonth: -1,
    minutesPerMeeting: 480,
    aiCallsPerMonth: -1,
    membersLimit: 50,
    price: 99,
    stripePriceId:
      process.env.STRIPE_PRICE_ID_PROFESSIONAL ?? process.env.STRIPE_PRICE_ID_PRO ?? null,
    features: ["会议数不限", "单场最长 480 分钟", "最多 50 名成员"],
  },
  [Plan.ENTERPRISE]: {
    name: "Enterprise",
    description: "适合需要定制配额、安全和支持的大型组织。",
    meetingsPerMonth: -1,
    minutesPerMeeting: -1,
    aiCallsPerMonth: -1,
    membersLimit: -1,
    price: null,
    stripePriceId: process.env.STRIPE_PRICE_ID_ENTERPRISE ?? null,
    features: ["会议数不限", "单场时长不限", "成员数不限", "专属支持"],
  },
} as const satisfies Record<Plan, BillingPlanConfig>;

export function getStripeServer() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  if (!globalForStripe.stripeServer) {
    globalForStripe.stripeServer = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
    });
  }

  return globalForStripe.stripeServer;
}

export function getPlanForPriceId(priceId: string | null | undefined): Plan {
  if (!priceId) {
    return Plan.FREE;
  }

  for (const [plan, config] of Object.entries(PLANS) as Array<[Plan, BillingPlanConfig]>) {
    if (config.stripePriceId === priceId) {
      return plan;
    }
  }

  return Plan.FREE;
}

export function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "past_due":
    case "unpaid":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    case "incomplete":
    case "incomplete_expired":
    case "paused":
    default:
      return SubscriptionStatus.INACTIVE;
  }
}

function getCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer) {
  return typeof customer === "string" ? customer : customer.id;
}

function toDate(seconds: number | null | undefined) {
  return seconds ? new Date(seconds * 1000) : null;
}

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];

  return {
    currentPeriodStart: toDate(item?.current_period_start),
    currentPeriodEnd: toDate(item?.current_period_end),
  };
}

export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata.organizationId;
  const stripePriceId = subscription.items.data[0]?.price.id ?? null;
  const plan = getPlanForPriceId(stripePriceId);
  const status = mapStripeSubscriptionStatus(subscription.status);
  const { currentPeriodStart, currentPeriodEnd } = getSubscriptionPeriod(subscription);

  if (!organizationId) {
    logger.warn({ subscriptionId: subscription.id }, "Stripe subscription missing organizationId metadata");
    return null;
  }

  const synced = await db.$transaction(async (tx) => {
    const record = await tx.subscription.upsert({
      where: {
        stripeSubscriptionId: subscription.id,
      },
      update: {
        stripeCustomerId: getCustomerId(subscription.customer),
        stripePriceId,
        status,
        plan,
        currentPeriodStart,
        currentPeriodEnd,
      },
      create: {
        organizationId,
        stripeCustomerId: getCustomerId(subscription.customer),
        stripeSubscriptionId: subscription.id,
        stripePriceId,
        status,
        plan,
        currentPeriodStart,
        currentPeriodEnd,
      },
    });

    await tx.organization.update({
      where: { id: organizationId },
      data: {
        plan: status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIALING ? plan : Plan.FREE,
      },
    });

    return record;
  });

  await Promise.all([
    invalidateBillingCurrentCache(organizationId),
    invalidateOrganizationCache(organizationId),
  ]);

  return synced;
}

export async function markStripeSubscriptionCanceled(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata.organizationId;

  const existing = await db.subscription.findUnique({
    where: {
      stripeSubscriptionId: subscription.id,
    },
    select: {
      organizationId: true,
    },
  });

  const updated = await db.subscription.updateMany({
    where: {
      stripeSubscriptionId: subscription.id,
    },
    data: {
      status: SubscriptionStatus.CANCELED,
      currentPeriodEnd: getSubscriptionPeriod(subscription).currentPeriodEnd,
    },
  });

  const targetOrganizationId = organizationId ?? existing?.organizationId;

  if (targetOrganizationId) {
    await db.organization.update({
      where: { id: targetOrganizationId },
      data: { plan: Plan.FREE },
    });
    await Promise.all([
      invalidateBillingCurrentCache(targetOrganizationId),
      invalidateOrganizationCache(targetOrganizationId),
    ]);
    void auditLog({
      action: "billing.cancel",
      resource: "Subscription",
      resourceId: subscription.id,
      metadata: {
        organizationId: targetOrganizationId,
        stripeSubscriptionId: subscription.id,
      },
    });
  }

  return updated;
}

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}
