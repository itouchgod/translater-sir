"use client";

import { useState } from "react";
import { toast } from "sonner";
import useSWRInfinite from "swr/infinite";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  deletedAt: string | null;
  createdAt: string;
  _count: {
    memberships: number;
    meetings: number;
    aiLogs: number;
  };
};

type PageData = {
  items: AdminUser[];
  nextCursor: string | null;
  hasMore: boolean;
};

type ApiResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

type DeleteResponse = {
  deleted: boolean;
};

async function fetchPage(url: string) {
  const response = await fetch(url);
  const payload = (await response.json()) as ApiResponse<PageData>;

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "获取用户失败");
  }

  return payload.data;
}

export function AdminUsersClient() {
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const users = useSWRInfinite((pageIndex, previousPageData: PageData | null) => {
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

    return `/api/admin/users?${params.toString()}`;
  }, fetchPage);
  const items = users.data?.flatMap((page) => page.items) ?? [];
  const lastPage = users.data?.at(-1);

  async function patchUser(user: AdminUser, action: "ban" | "unban") {
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as ApiResponse<AdminUser>;

      if (!response.ok || payload.error || !payload.data) {
        throw new Error(payload.error?.message ?? "用户操作失败");
      }

      toast.success(action === "ban" ? "用户已封禁" : "用户已解封");
      await users.mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "用户操作失败");
    }
  }

  async function deleteUser(user: AdminUser) {
    const label = `${user.email}${user.name ? `（${user.name}）` : ""}`;

    if (!window.confirm(`确定永久删除用户 ${label} 吗？此操作不可恢复。`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as ApiResponse<DeleteResponse>;

      if (!response.ok || payload.error || !payload.data?.deleted) {
        throw new Error(payload.error?.message ?? "删除用户失败");
      }

      toast.success("用户已删除");
      await users.mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除用户失败");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">用户管理</h1>
        <p className="text-sm text-muted-foreground">搜索用户并执行封禁、解封或永久删除操作。</p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedQuery(query.trim());
          void users.setSize(1);
        }}
      >
        <Input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="搜索邮箱或姓名" />
        <Button type="submit">搜索</Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>用户</TableHead>
            <TableHead>角色</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>组织/会议/AI</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="font-medium">{user.email}</div>
                <div className="text-xs text-muted-foreground">{user.name || "-"}</div>
              </TableCell>
              <TableCell>{user.role}</TableCell>
              <TableCell>
                <Badge variant={user.deletedAt ? "destructive" : "secondary"}>
                  {user.deletedAt ? "已封禁" : "正常"}
                </Badge>
              </TableCell>
              <TableCell>
                {user._count.memberships} / {user._count.meetings} / {user._count.aiLogs}
              </TableCell>
              <TableCell>{new Date(user.createdAt).toLocaleString("zh-CN", { hour12: false })}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={user.deletedAt ? "outline" : "destructive"}
                    onClick={() => void patchUser(user, user.deletedAt ? "unban" : "ban")}
                  >
                    {user.deletedAt ? "解封" : "封禁"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void deleteUser(user)}>
                    删除
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {lastPage?.hasMore ? (
        <Button type="button" variant="outline" onClick={() => void users.setSize((size) => size + 1)}>
          加载更多
        </Button>
      ) : null}
    </div>
  );
}
