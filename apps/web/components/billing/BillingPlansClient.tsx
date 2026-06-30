"use client";

import Link from "next/link";
import useSWR from "swr";
import { Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiPayload, BillingCurrent, BillingPlanConfig } from "@/components/billing/types";

type PlanKey = "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

const PLAN_ORDER: PlanKey[] = ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"];

async function fetchBillingCurrent(url: string) {
  const response = await fetch(url);
  const payload = (await response.json()) as ApiPayload<BillingCurrent>;

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "加载订阅计划失败");
  }

  return payload.data;
}

function formatPrice(plan: BillingPlanConfig) {
  if (plan.price === null) {
    return "联系销售";
  }

  if (plan.price === 0) {
    return "$0";
  }

  return `$${plan.price}`;
}

export function BillingPlansClient() {
  const billing = useSWR("/api/billing/current", fetchBillingCurrent);
  const [pendingPlan, setPendingPlan] = useState<PlanKey | null>(null);
  const data = billing.data;

  async function startCheckout(plan: PlanKey) {
    setPendingPlan(plan);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });
      const payload = (await response.json()) as ApiPayload<{ url: string }>;

      if (!response.ok || payload.error || !payload.data?.url) {
        throw new Error(payload.error?.message ?? "无法创建 Stripe Checkout Session");
      }

      window.location.href = payload.data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "无法创建 Stripe Checkout Session");
      setPendingPlan(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">订阅计划</h1>
          <p className="text-sm text-muted-foreground">选择适合当前组织的会议和 AI 用量额度。</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/billing">返回计费</Link>
        </Button>
      </div>

      {!data ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((plan) => (
            <Card key={plan}>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-36" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((planKey) => {
            const plan = data.plans[planKey];
            const isCurrent = data.organization.plan === planKey;
            const canCheckout = planKey === "STARTER" || planKey === "PROFESSIONAL";

            return (
              <Card key={planKey} className={isCurrent ? "border-primary" : undefined}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{plan.name}</CardTitle>
                    {isCurrent ? <Badge>当前</Badge> : null}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-semibold tracking-normal">{formatPrice(plan)}</span>
                    {typeof plan.price === "number" && plan.price > 0 ? (
                      <span className="pb-1 text-sm text-muted-foreground">/月</span>
                    ) : null}
                  </div>
                  <ul className="grid gap-2 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Check className="size-4 text-emerald-600" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {canCheckout ? (
                    <Button
                      type="button"
                      className="w-full"
                      disabled={isCurrent || pendingPlan !== null}
                      onClick={() => void startCheckout(planKey)}
                    >
                      <Sparkles className="size-4" />
                      {pendingPlan === planKey ? "跳转中" : isCurrent ? "当前计划" : "升级"}
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="w-full" disabled={isCurrent}>
                      <Link href={planKey === "FREE" ? "/billing" : "mailto:sales@example.com"}>
                        {isCurrent ? "当前计划" : "联系销售"}
                      </Link>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
