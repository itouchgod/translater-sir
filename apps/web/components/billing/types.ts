import type { Plan, SubscriptionStatus } from "@prisma/client";

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

export type BillingUsage = {
  meetingsThisMonth: number;
  members: number;
  aiCallsThisMonth: number;
};

export type BillingCurrent = {
  organization: {
    id: string;
    name: string;
    plan: Plan;
  };
  subscription: {
    id: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    status: SubscriptionStatus;
    plan: Plan;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  } | null;
  usage: BillingUsage;
  currentPlan: BillingPlanConfig;
  plans: Record<Plan, BillingPlanConfig>;
};

export type ApiPayload<TData> = {
  data: TData | null;
  error: { code?: string; message: string } | null;
};
