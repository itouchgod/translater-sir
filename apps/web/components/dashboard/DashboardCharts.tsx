"use client";

import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardStats } from "@/lib/dashboard";

const COLORS = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#4b5563", "#c2410c"];

type DashboardChartsProps = {
  dailyMeetings: DashboardStats["dailyMeetings"];
  languagePairStats: DashboardStats["languagePairStats"];
};

export function DashboardCharts({ dailyMeetings, languagePairStats }: DashboardChartsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>最近 7 天会议趋势</CardTitle>
          <CardDescription>按会议创建日期统计。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyMeetings} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" name="会议数" stroke="#2563eb" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>语言对分布</CardTitle>
          <CardDescription>按当前组织全部会议统计。</CardDescription>
        </CardHeader>
        <CardContent>
          {languagePairStats.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip />
                  <Pie
                    data={languagePairStats}
                    dataKey="count"
                    nameKey="pair"
                    innerRadius={48}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {languagePairStats.map((entry, index) => (
                      <Cell key={entry.pair} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-72 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              暂无语言对数据
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
