"use client";

import { AiType } from "@prisma/client";
import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AiLog = {
  id: string;
  provider: string;
  model: string;
  type: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: string;
  error: string | null;
  createdAt: string;
  user: { email: string; name: string | null } | null;
  meeting: { id: string; title: string; organizationId: string } | null;
};

type PageData = {
  items: AiLog[];
  nextCursor: string | null;
  hasMore: boolean;
};

type ApiResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

async function fetchLogs(url: string) {
  const response = await fetch(url);
  const payload = (await response.json()) as ApiResponse<PageData>;

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "获取 AI 日志失败");
  }

  return payload.data;
}

export function AdminLogsClient() {
  const [provider, setProvider] = useState("");
  const [type, setType] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filters, setFilters] = useState({ provider: "", type: "ALL", dateFrom: "", dateTo: "" });
  const logs = useSWRInfinite((pageIndex, previousPageData: PageData | null) => {
    if (previousPageData && !previousPageData.hasMore) {
      return null;
    }

    const params = new URLSearchParams({ limit: "20" });

    if (filters.provider) {
      params.set("provider", filters.provider);
    }

    if (filters.type !== "ALL") {
      params.set("type", filters.type);
    }

    if (filters.dateFrom) {
      params.set("dateFrom", `${filters.dateFrom}T00:00:00.000`);
    }

    if (filters.dateTo) {
      params.set("dateTo", `${filters.dateTo}T23:59:59.999`);
    }

    if (pageIndex > 0 && previousPageData?.nextCursor) {
      params.set("cursor", previousPageData.nextCursor);
    }

    return `/api/admin/ai-logs?${params.toString()}`;
  }, fetchLogs);
  const items = logs.data?.flatMap((page) => page.items) ?? [];
  const lastPage = logs.data?.at(-1);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">AI 调用日志</h1>
        <p className="text-sm text-muted-foreground">按 Provider、类型和日期筛选 AI 调用。</p>
      </div>

      <form
        className="grid gap-2 md:grid-cols-[1fr_10rem_10rem_10rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters({ provider: provider.trim(), type, dateFrom, dateTo });
          void logs.setSize(1);
        }}
      >
        <Input value={provider} onChange={(event) => setProvider(event.currentTarget.value)} placeholder="Provider" />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部类型</SelectItem>
            {Object.values(AiType).map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.currentTarget.value)} />
        <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.currentTarget.value)} />
        <Button type="submit">筛选</Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>时间</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>模型</TableHead>
            <TableHead>Token</TableHead>
            <TableHead>延迟</TableHead>
            <TableHead>用户/会议</TableHead>
            <TableHead>状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((log) => (
            <TableRow key={log.id}>
              <TableCell>{new Date(log.createdAt).toLocaleString("zh-CN", { hour12: false })}</TableCell>
              <TableCell>{log.type}</TableCell>
              <TableCell>
                <div>{log.provider}</div>
                <div className="text-xs text-muted-foreground">{log.model}</div>
              </TableCell>
              <TableCell>{log.inputTokens + log.outputTokens}</TableCell>
              <TableCell>{log.latencyMs}ms</TableCell>
              <TableCell>
                <div>{log.user?.email ?? "-"}</div>
                <div className="text-xs text-muted-foreground">{log.meeting?.title ?? "-"}</div>
              </TableCell>
              <TableCell>{log.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {lastPage?.hasMore ? (
        <Button type="button" variant="outline" onClick={() => void logs.setSize((size) => size + 1)}>
          加载更多
        </Button>
      ) : null}
    </div>
  );
}
