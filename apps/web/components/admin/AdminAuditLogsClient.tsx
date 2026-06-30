"use client";

import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AuditLog = {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null } | null;
};

type PageData = {
  items: AuditLog[];
  nextCursor: string | null;
  hasMore: boolean;
};

type ApiResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

async function fetchAuditLogs(url: string) {
  const response = await fetch(url);
  const payload = (await response.json()) as ApiResponse<PageData>;

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "获取审计日志失败");
  }

  return payload.data;
}

function compactMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return "-";
  }

  return JSON.stringify(metadata);
}

export function AdminAuditLogsClient() {
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filters, setFilters] = useState({ userId: "", action: "", resource: "", dateFrom: "", dateTo: "" });
  const logs = useSWRInfinite((pageIndex, previousPageData: PageData | null) => {
    if (previousPageData && !previousPageData.hasMore) {
      return null;
    }

    const params = new URLSearchParams({ limit: "20" });

    if (filters.userId) {
      params.set("userId", filters.userId);
    }

    if (filters.action) {
      params.set("action", filters.action);
    }

    if (filters.resource) {
      params.set("resource", filters.resource);
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

    return `/api/admin/audit-logs?${params.toString()}`;
  }, fetchAuditLogs);
  const items = logs.data?.flatMap((page) => page.items) ?? [];
  const lastPage = logs.data?.at(-1);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">审计日志</h1>
        <p className="text-sm text-muted-foreground">按用户、操作、资源和日期筛选关键操作记录。</p>
      </div>

      <form
        className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_10rem_10rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters({
            userId: userId.trim(),
            action: action.trim(),
            resource: resource.trim(),
            dateFrom,
            dateTo,
          });
          void logs.setSize(1);
        }}
      >
        <Input value={userId} onChange={(event) => setUserId(event.currentTarget.value)} placeholder="User ID" />
        <Input value={action} onChange={(event) => setAction(event.currentTarget.value)} placeholder="Action" />
        <Input value={resource} onChange={(event) => setResource(event.currentTarget.value)} placeholder="Resource" />
        <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.currentTarget.value)} />
        <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.currentTarget.value)} />
        <Button type="submit">筛选</Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>时间</TableHead>
            <TableHead>用户</TableHead>
            <TableHead>操作</TableHead>
            <TableHead>资源</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>Metadata</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((log) => (
            <TableRow key={log.id}>
              <TableCell>{new Date(log.createdAt).toLocaleString("zh-CN", { hour12: false })}</TableCell>
              <TableCell>
                <div>{log.user?.email ?? log.userId ?? "-"}</div>
                <div className="text-xs text-muted-foreground">{log.user?.name ?? ""}</div>
              </TableCell>
              <TableCell>{log.action}</TableCell>
              <TableCell>
                <div>{log.resource}</div>
                <div className="text-xs text-muted-foreground">{log.resourceId ?? "-"}</div>
              </TableCell>
              <TableCell>{log.ip ?? "-"}</TableCell>
              <TableCell className="max-w-xs truncate">{compactMetadata(log.metadata)}</TableCell>
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
