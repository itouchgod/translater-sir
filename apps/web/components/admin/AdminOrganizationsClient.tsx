"use client";

import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: string;
  _count: {
    members: number;
    meetings: number;
    dictionaries: number;
    apiKeys: number;
  };
};

type PageData = {
  items: Organization[];
  nextCursor: string | null;
  hasMore: boolean;
};

type ApiResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

async function fetchOrganizations(url: string) {
  const response = await fetch(url);
  const payload = (await response.json()) as ApiResponse<PageData>;

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "获取组织失败");
  }

  return payload.data;
}

export function AdminOrganizationsClient() {
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const organizations = useSWRInfinite((pageIndex, previousPageData: PageData | null) => {
    if (previousPageData && !previousPageData.hasMore) {
      return null;
    }

    const params = new URLSearchParams({ limit: "20" });

    if (appliedQuery) {
      params.set("q", appliedQuery);
    }

    if (pageIndex > 0 && previousPageData?.nextCursor) {
      params.set("cursor", previousPageData.nextCursor);
    }

    return `/api/admin/organizations?${params.toString()}`;
  }, fetchOrganizations);
  const items = organizations.data?.flatMap((page) => page.items) ?? [];
  const lastPage = organizations.data?.at(-1);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">组织管理</h1>
        <p className="text-sm text-muted-foreground">查看平台所有组织与资源规模。</p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedQuery(query.trim());
          void organizations.setSize(1);
        }}
      >
        <Input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="搜索组织名或 slug" />
        <Button type="submit">搜索</Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>组织</TableHead>
            <TableHead>计划</TableHead>
            <TableHead>成员</TableHead>
            <TableHead>会议</TableHead>
            <TableHead>词典/API Key</TableHead>
            <TableHead>创建时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((organization) => (
            <TableRow key={organization.id}>
              <TableCell>
                <div className="font-medium">{organization.name}</div>
                <div className="text-xs text-muted-foreground">{organization.slug}</div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{organization.plan}</Badge>
              </TableCell>
              <TableCell>{organization._count.members}</TableCell>
              <TableCell>{organization._count.meetings}</TableCell>
              <TableCell>
                {organization._count.dictionaries} / {organization._count.apiKeys}
              </TableCell>
              <TableCell>{new Date(organization.createdAt).toLocaleString("zh-CN", { hour12: false })}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {lastPage?.hasMore ? (
        <Button type="button" variant="outline" onClick={() => void organizations.setSize((size) => size + 1)}>
          加载更多
        </Button>
      ) : null}
    </div>
  );
}
