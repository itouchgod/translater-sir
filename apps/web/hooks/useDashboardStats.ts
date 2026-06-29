"use client";

import useSWR from "swr";
import type { DashboardStats } from "@/lib/dashboard";

type StatsResponse = {
  data: DashboardStats | null;
  error: { message: string } | null;
};

async function fetchDashboardStats(url: string) {
  const response = await fetch(url);
  const payload = (await response.json()) as StatsResponse;

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "获取统计数据失败");
  }

  return payload.data;
}

export function useDashboardStats() {
  return useSWR("/api/dashboard/stats", fetchDashboardStats, {
    refreshInterval: 60_000,
  });
}
