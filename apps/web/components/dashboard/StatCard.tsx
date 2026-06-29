"use client";

import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string;
  icon: LucideIcon;
  change: number | null;
};

export function StatCard({ title, value, icon: Icon, change }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <p
          className={cn(
            "mt-1 text-xs",
            change === null
              ? "text-muted-foreground"
              : change >= 0
                ? "text-emerald-700"
                : "text-red-600",
          )}
        >
          {change === null ? "暂无上月对比" : `${change >= 0 ? "+" : ""}${change}% 较上月`}
        </p>
      </CardContent>
    </Card>
  );
}
