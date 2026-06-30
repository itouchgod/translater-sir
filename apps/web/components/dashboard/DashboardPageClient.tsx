"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Bot, Clock3, MessageSquareText, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RecentMeetings } from "@/components/dashboard/RecentMeetings";
import { StatCard } from "@/components/dashboard/StatCard";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDashboardStats } from "@/hooks/useDashboardStats";

const DashboardCharts = dynamic(
  () => import("@/components/dashboard/DashboardCharts").then((module) => module.DashboardCharts),
  {
    ssr: false,
    loading: () => <DashboardChartsSkeleton />,
  },
);

function DashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="mt-2 h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardChartsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function DashboardPageClient() {
  const stats = useDashboardStats();
  const currentUser = useCurrentUser();
  const data = stats.data;
  const userName = currentUser.data?.name || currentUser.data?.email || "你好";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{userName}，这里是当前组织的会议与 AI 使用概览。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/meetings/new">快速开始</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/history">搜索历史</Link>
          </Button>
        </div>
      </div>

      {stats.isLoading || !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="本月会议"
              value={formatInteger(data.meetingsThisMonth)}
              icon={Video}
              change={data.changes.meetings}
            />
            <StatCard
              title="本月时长"
              value={`${data.hoursTranslatedThisMonth} h`}
              icon={Clock3}
              change={data.changes.hours}
            />
            <StatCard
              title="本月 AI 调用"
              value={formatInteger(data.aiCallsThisMonth)}
              icon={Bot}
              change={data.changes.aiCalls}
            />
            <StatCard
              title="本月 Token"
              value={formatInteger(data.tokensUsedThisMonth)}
              icon={MessageSquareText}
              change={data.changes.tokens}
            />
          </div>

          <DashboardCharts
            dailyMeetings={data.dailyMeetings}
            languagePairStats={data.languagePairStats}
          />

          <Card>
            <CardHeader>
              <CardTitle>最近会议</CardTitle>
              <CardDescription>
                当前组织累计 {formatInteger(data.totalMeetings)} 场会议。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentMeetings meetings={data.recentMeetings} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
