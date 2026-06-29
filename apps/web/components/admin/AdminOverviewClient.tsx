"use client";

import Link from "next/link";
import { Activity, Building2, Bot, Users, Video } from "lucide-react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/StatCard";

type AdminStats = {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  totalOrganizations: number;
  totalMeetings: number;
  liveMeetings: number;
  totalAiCalls: number;
  totalTokens: number;
};

type Health = {
  db: { status: "ok" | "error"; latencyMs: number };
  redis: { status: "ok" | "error"; latencyMs: number };
  r2: { status: "ok" | "error"; latencyMs: number };
  overall: "healthy" | "degraded" | "down";
};

async function fetchJson<T>(url: string) {
  const response = await fetch(url);
  const payload = (await response.json()) as { data?: T | null; error?: { message: string } | null } & T;

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? "请求失败");
  }

  return "data" in payload ? (payload.data as T) : (payload as T);
}

function HealthItem({ label, item }: { label: string; item?: Health["db"] }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3 text-sm">
      <span>{label}</span>
      {item ? (
        <span className={item.status === "ok" ? "text-emerald-700" : "text-red-600"}>
          {item.status} · {item.latencyMs}ms
        </span>
      ) : (
        <Skeleton className="h-4 w-20" />
      )}
    </div>
  );
}

export function AdminOverviewClient() {
  const stats = useSWR("/api/admin/stats", fetchJson<AdminStats>);
  const health = useSWR("/api/admin/health", fetchJson<Health>, {
    refreshInterval: 30_000,
  });
  const data = stats.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">管理员后台</h1>
          <p className="text-sm text-muted-foreground">查看全平台运行状态、用户、组织和 AI 调用。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/users">用户</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/organizations">组织</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/logs">AI 日志</Link>
          </Button>
        </div>
      </div>

      {data ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="用户总数" value={String(data.totalUsers)} icon={Users} change={null} />
          <StatCard title="组织总数" value={String(data.totalOrganizations)} icon={Building2} change={null} />
          <StatCard title="会议总数" value={String(data.totalMeetings)} icon={Video} change={null} />
          <StatCard title="AI 调用" value={String(data.totalAiCalls)} icon={Bot} change={null} />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-muted-foreground" />
            <CardTitle>系统健康</CardTitle>
          </div>
          <CardDescription>每 30 秒自动刷新一次。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Overall: {health.data?.overall ?? "checking"}
          </p>
          <HealthItem label="Database" item={health.data?.db} />
          <HealthItem label="Redis" item={health.data?.redis} />
          <HealthItem label="R2" item={health.data?.r2} />
        </CardContent>
      </Card>
    </div>
  );
}
