"use client";

import Link from "next/link";
import useSWR from "swr";
import { CreditCard, ExternalLink, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiPayload, BillingCurrent } from "@/components/billing/types";

async function fetchBillingCurrent(url: string) {
  const response = await fetch(url);
  const payload = (await response.json()) as ApiPayload<BillingCurrent>;

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "加载订阅信息失败");
  }

  return payload.data;
}

function formatLimit(value: number) {
  return value < 0 ? "不限" : new Intl.NumberFormat("zh-CN").format(value);
}

function quotaPercent(used: number, limit: number) {
  if (limit < 0) {
    return 100;
  }

  return Math.min(Math.round((used / Math.max(limit, 1)) * 100), 100);
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {new Intl.NumberFormat("zh-CN").format(used)} / {formatLimit(limit)}
        </span>
      </div>
      <Progress value={quotaPercent(used, limit)} />
    </div>
  );
}

function BillingSkeleton() {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="grid gap-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function BillingPageClient() {
  const billing = useSWR("/api/billing/current", fetchBillingCurrent);
  const data = billing.data;

  async function openPortal() {
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = (await response.json()) as ApiPayload<{ url: string }>;

      if (!response.ok || payload.error || !payload.data?.url) {
        throw new Error(payload.error?.message ?? "无法打开客户门户");
      }

      window.location.href = payload.data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "无法打开客户门户");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">计费</h1>
          <p className="text-sm text-muted-foreground">查看当前计划、用量和订阅状态。</p>
        </div>
        <Button asChild>
          <Link href="/billing/plans">查看计划</Link>
        </Button>
      </div>

      {billing.isLoading || !data ? (
        <BillingSkeleton />
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ReceiptText className="size-5 text-muted-foreground" />
                <CardTitle>{data.currentPlan.name}</CardTitle>
                <Badge variant={data.subscription?.status === "ACTIVE" ? "default" : "secondary"}>
                  {data.subscription?.status ?? "FREE"}
                </Badge>
              </div>
              <CardDescription>{data.currentPlan.description}</CardDescription>
              <CardAction>
                {data.subscription?.stripeCustomerId ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => void openPortal()}>
                    <CreditCard className="size-4" />
                    管理订阅
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/billing/plans">
                      <ExternalLink className="size-4" />
                      升级
                    </Link>
                  </Button>
                )}
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-5">
              <UsageBar
                label="本月会议"
                used={data.usage.meetingsThisMonth}
                limit={data.currentPlan.meetingsPerMonth}
              />
              <UsageBar label="成员数" used={data.usage.members} limit={data.currentPlan.membersLimit} />
              <UsageBar
                label="本月 AI 调用"
                used={data.usage.aiCallsThisMonth}
                limit={data.currentPlan.aiCallsPerMonth}
              />
              <p className="text-sm text-muted-foreground">
                单场会议最长 {formatLimit(data.currentPlan.minutesPerMeeting)} 分钟。
                {data.subscription?.currentPeriodEnd
                  ? ` 当前周期到 ${new Date(data.subscription.currentPeriodEnd).toLocaleDateString("zh-CN")}。`
                  : ""}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
