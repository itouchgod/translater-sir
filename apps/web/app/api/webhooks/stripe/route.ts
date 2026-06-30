import { SubscriptionStatus } from "@prisma/client";
import type Stripe from "stripe";
import { apiError, apiSuccess } from "@/lib/api-response";
import { invalidateBillingCurrentCache, invalidateOrganizationCache } from "@/lib/cache-invalidation";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mail";
import {
  getStripeServer,
  markStripeSubscriptionCanceled,
  syncStripeSubscription,
} from "@/lib/stripe";

export const runtime = "nodejs";

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice) {
  const subscription = invoice.parent?.subscription_details?.subscription;

  if (!subscription) {
    return null;
  }

  return typeof subscription === "string" ? subscription : subscription.id;
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);

  if (!subscriptionId) {
    return;
  }

  const subscription = await getStripeServer().subscriptions.retrieve(subscriptionId);
  await syncStripeSubscription(subscription);
}

async function notifyPaymentFailed(subscriptionId: string) {
  const localSubscription = await db.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: {
      organization: {
        select: {
          name: true,
          members: {
            where: { role: "OWNER" },
            select: {
              user: {
                select: {
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!localSubscription) {
    return;
  }

  await db.$transaction([
    db.subscription.update({
      where: { id: localSubscription.id },
      data: { status: SubscriptionStatus.PAST_DUE },
    }),
    db.organization.update({
      where: { id: localSubscription.organizationId },
      data: { plan: "FREE" },
    }),
  ]);
  await Promise.all([
    invalidateBillingCurrentCache(localSubscription.organizationId),
    invalidateOrganizationCache(localSubscription.organizationId),
  ]);

  await Promise.all(
    localSubscription.organization.members.map((member) =>
      sendMail({
        to: member.user.email,
        subject: `${localSubscription.organization.name} 订阅付款失败`,
        text: "Stripe 订阅扣款失败。请前往计费页面更新付款方式，以免影响组织配额。",
        html: "<p>Stripe 订阅扣款失败。</p><p>请前往计费页面更新付款方式，以免影响组织配额。</p>",
      }),
    ),
  );
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);

  if (!subscriptionId) {
    return;
  }

  await notifyPaymentFailed(subscriptionId);
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await syncStripeSubscription(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await markStripeSubscriptionCanceled(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_succeeded":
      await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    default:
      logger.debug({ type: event.type }, "Unhandled Stripe webhook event");
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return apiError("STRIPE_WEBHOOK_SIGNATURE_REQUIRED", "Stripe Webhook 签名缺失或未配置", 400);
  }

  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = getStripeServer().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    logger.warn({ error }, "Invalid Stripe webhook signature");
    return apiError("STRIPE_WEBHOOK_SIGNATURE_INVALID", "Stripe Webhook 签名无效", 400);
  }

  try {
    await handleEvent(event);
  } catch (error) {
    logger.error({ error, eventType: event.type, eventId: event.id }, "Stripe webhook handling failed");
    return apiError("STRIPE_WEBHOOK_HANDLER_FAILED", "Stripe Webhook 处理失败", 500);
  }

  return apiSuccess({ received: true });
}
