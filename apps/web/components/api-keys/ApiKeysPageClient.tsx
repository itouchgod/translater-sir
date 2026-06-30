"use client";

import { Copy, KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ApiKeyScope =
  | "meetings:read"
  | "meetings:write"
  | "segments:read"
  | "dictionaries:read"
  | "dictionaries:write";

type ApiKeyListItem = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
};

type ApiPayload<TData> = {
  data: TData | null;
  error: { message: string } | null;
};

const SCOPES: Array<{ value: ApiKeyScope; label: string }> = [
  { value: "meetings:read", label: "读取会议" },
  { value: "meetings:write", label: "写入会议" },
  { value: "segments:read", label: "读取字幕" },
  { value: "dictionaries:read", label: "读取词典" },
  { value: "dictionaries:write", label: "写入词典" },
];

const DEFAULT_SCOPES: ApiKeyScope[] = ["meetings:read"];

async function fetchApiKeys(url: string) {
  const response = await fetch(url);
  const payload = (await response.json()) as ApiPayload<{ items: ApiKeyListItem[] }>;

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "加载 API Key 失败");
  }

  return payload.data.items;
}

function formatDate(value: string | null) {
  if (!value) {
    return "永久";
  }

  return new Date(value).toLocaleString("zh-CN");
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function ScopePicker({
  selected,
  onChange,
}: {
  selected: ApiKeyScope[];
  onChange: (next: ApiKeyScope[]) => void;
}) {
  function toggle(scope: ApiKeyScope) {
    if (selected.includes(scope)) {
      onChange(selected.filter((item) => item !== scope));
      return;
    }

    onChange([...selected, scope]);
  }

  return (
    <div className="grid gap-2">
      {SCOPES.map((scope) => (
        <label key={scope.value} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded border"
            checked={selected.includes(scope.value)}
            onChange={() => toggle(scope.value)}
          />
          <span>{scope.label}</span>
        </label>
      ))}
    </div>
  );
}

function ApiKeyDialog({
  apiKey,
  onSaved,
  onCreated,
}: {
  apiKey?: ApiKeyListItem;
  onSaved: () => void;
  onCreated?: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(apiKey?.name ?? "");
  const [expiresAt, setExpiresAt] = useState(toDateTimeLocal(apiKey?.expiresAt ?? null));
  const [scopes, setScopes] = useState<ApiKeyScope[]>(apiKey?.scopes ?? DEFAULT_SCOPES);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(apiKey ? `/api/api-keys/${encodeURIComponent(apiKey.id)}` : "/api/api-keys", {
        method: apiKey ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          scopes,
          expiresAt: toIsoOrNull(expiresAt),
        }),
      });
      const payload = (await response.json()) as ApiPayload<{
        key?: string;
        apiKey?: ApiKeyListItem;
      }>;

      if (!response.ok || payload.error || !payload.data) {
        throw new Error(payload.error?.message ?? "保存 API Key 失败");
      }

      toast.success(apiKey ? "API Key 已更新" : "API Key 已创建");
      setOpen(false);
      onSaved();

      if (!apiKey && payload.data.key) {
        onCreated?.(payload.data.key);
        setName("");
        setExpiresAt("");
        setScopes(DEFAULT_SCOPES);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存 API Key 失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={apiKey ? "outline" : "default"} size={apiKey ? "sm" : "default"}>
          {apiKey ? <Pencil className="size-4" /> : <Plus className="size-4" />}
          {apiKey ? "编辑" : "创建 API Key"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form className="grid gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{apiKey ? "编辑 API Key" : "创建 API Key"}</DialogTitle>
            <DialogDescription>设置名称、权限范围和可选到期时间。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor={`api-key-name-${apiKey?.id ?? "new"}`}>名称</Label>
            <Input
              id={`api-key-name-${apiKey?.id ?? "new"}`}
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              required
              maxLength={80}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`api-key-expires-${apiKey?.id ?? "new"}`}>到期时间</Label>
            <Input
              id={`api-key-expires-${apiKey?.id ?? "new"}`}
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.currentTarget.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>权限范围</Label>
            <ScopePicker selected={scopes} onChange={setScopes} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || scopes.length === 0}>
              {isSubmitting ? "保存中" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SecretDialog({ value, onClose }: { value: string | null; onClose: () => void }) {
  async function copy() {
    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(value);
    toast.success("已复制到剪贴板");
  }

  return (
    <Dialog open={Boolean(value)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API Key 已创建</DialogTitle>
          <DialogDescription>此 Key 只显示一次，请立即保存。</DialogDescription>
        </DialogHeader>
        <Alert>
          <KeyRound className="size-4" />
          <AlertTitle>此 Key 只显示一次，请立即保存</AlertTitle>
          <AlertDescription>
            关闭窗口后无法再次查看完整 Key，只能重新创建。
          </AlertDescription>
        </Alert>
        <pre className="overflow-x-auto rounded-md border bg-muted p-3 text-sm">{value}</pre>
        <DialogFooter>
          <Button type="button" onClick={() => void copy()}>
            <Copy className="size-4" />
            已复制到剪贴板
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApiKeysPageClient() {
  const apiKeys = useSWR("/api/api-keys", fetchApiKeys);
  const [secret, setSecret] = useState<string | null>(null);

  async function deleteApiKey(apiKey: ApiKeyListItem) {
    if (!window.confirm(`确定删除 ${apiKey.name} 吗？删除后会立即失效。`)) {
      return;
    }

    try {
      const response = await fetch(`/api/api-keys/${encodeURIComponent(apiKey.id)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as ApiPayload<{ deleted: boolean }>;

      if (!response.ok || payload.error || !payload.data?.deleted) {
        throw new Error(payload.error?.message ?? "删除 API Key 失败");
      }

      toast.success("API Key 已删除");
      await apiKeys.mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除 API Key 失败");
    }
  }

  const items = apiKeys.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">API Key</h1>
          <p className="text-sm text-muted-foreground">为第三方系统创建受限权限的访问凭证。</p>
        </div>
        <ApiKeyDialog onSaved={() => void apiKeys.mutate()} onCreated={setSecret} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>已创建的 Key</CardTitle>
          <CardDescription>列表不会展示完整 Key，完整值只在创建后显示一次。</CardDescription>
        </CardHeader>
        <CardContent>
          {apiKeys.isLoading ? (
            <div className="grid gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              暂无 API Key
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>最后使用</TableHead>
                  <TableHead>到期时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell className="font-medium">{apiKey.name}</TableCell>
                    <TableCell>{apiKey.keyPrefix}...</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {apiKey.scopes.map((scope) => (
                          <Badge key={scope} variant="secondary">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(apiKey.lastUsedAt)}</TableCell>
                    <TableCell>{formatDate(apiKey.expiresAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <ApiKeyDialog apiKey={apiKey} onSaved={() => void apiKeys.mutate()} />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => void deleteApiKey(apiKey)}
                        >
                          <Trash2 className="size-4" />
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SecretDialog value={secret} onClose={() => setSecret(null)} />
    </div>
  );
}
