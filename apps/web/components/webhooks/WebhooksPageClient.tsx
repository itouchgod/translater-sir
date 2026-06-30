"use client";

import { Copy, Pencil, Plus, Send, Trash2, Webhook as WebhookIcon } from "lucide-react";
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

type WebhookEvent = "meeting.started" | "meeting.ended" | "meeting.summary.ready" | "export.ready";

type WebhookListItem = {
  id: string;
  url: string;
  events: WebhookEvent[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deliveries: Array<{
    id: string;
    event: string;
    statusCode: number | null;
    latencyMs: number;
    error: string | null;
    createdAt: string;
  }>;
};

type ApiPayload<TData> = {
  data: TData | null;
  error: { message: string } | null;
};

const EVENTS: Array<{ value: WebhookEvent; label: string }> = [
  { value: "meeting.started", label: "会议开始" },
  { value: "meeting.ended", label: "会议结束" },
  { value: "meeting.summary.ready", label: "纪要生成" },
  { value: "export.ready", label: "导出完成" },
];

async function fetchWebhooks(url: string) {
  const response = await fetch(url);
  const payload = (await response.json()) as ApiPayload<{ items: WebhookListItem[] }>;

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "加载 Webhook 失败");
  }

  return payload.data.items;
}

function EventPicker({
  selected,
  onChange,
}: {
  selected: WebhookEvent[];
  onChange: (next: WebhookEvent[]) => void;
}) {
  function toggle(event: WebhookEvent) {
    if (selected.includes(event)) {
      onChange(selected.filter((item) => item !== event));
      return;
    }

    onChange([...selected, event]);
  }

  return (
    <div className="grid gap-2">
      {EVENTS.map((event) => (
        <label key={event.value} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded border"
            checked={selected.includes(event.value)}
            onChange={() => toggle(event.value)}
          />
          <span>{event.label}</span>
        </label>
      ))}
    </div>
  );
}

function statusLabel(webhook: WebhookListItem) {
  const latest = webhook.deliveries[0];

  if (!latest) {
    return "未发送";
  }

  return latest.error ? `失败：${latest.error}` : `成功：HTTP ${latest.statusCode}`;
}

function WebhookDialog({
  webhook,
  onSaved,
  onCreated,
}: {
  webhook?: WebhookListItem;
  onSaved: () => void;
  onCreated?: (secret: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(webhook?.url ?? "");
  const [events, setEvents] = useState<WebhookEvent[]>(webhook?.events ?? ["meeting.started"]);
  const [isActive, setIsActive] = useState(webhook?.isActive ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(webhook ? `/api/webhooks/${encodeURIComponent(webhook.id)}` : "/api/webhooks", {
        method: webhook ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          events,
          isActive,
        }),
      });
      const payload = (await response.json()) as ApiPayload<{ secret?: string }>;

      if (!response.ok || payload.error || !payload.data) {
        throw new Error(payload.error?.message ?? "保存 Webhook 失败");
      }

      toast.success(webhook ? "Webhook 已更新" : "Webhook 已创建");
      setOpen(false);
      onSaved();

      if (!webhook && payload.data.secret) {
        onCreated?.(payload.data.secret);
        setUrl("");
        setEvents(["meeting.started"]);
        setIsActive(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存 Webhook 失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={webhook ? "outline" : "default"} size={webhook ? "sm" : "default"}>
          {webhook ? <Pencil className="size-4" /> : <Plus className="size-4" />}
          {webhook ? "编辑" : "创建 Webhook"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form className="grid gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{webhook ? "编辑 Webhook" : "创建 Webhook"}</DialogTitle>
            <DialogDescription>配置接收事件的 HTTPS 端点。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor={`webhook-url-${webhook?.id ?? "new"}`}>URL</Label>
            <Input
              id={`webhook-url-${webhook?.id ?? "new"}`}
              value={url}
              onChange={(event) => setUrl(event.currentTarget.value)}
              placeholder="https://example.com/webhooks/speech"
              required
              maxLength={2048}
            />
          </div>

          <div className="grid gap-2">
            <Label>事件</Label>
            <EventPicker selected={events} onChange={setEvents} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border"
              checked={isActive}
              onChange={(event) => setIsActive(event.currentTarget.checked)}
            />
            <span>启用</span>
          </label>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || events.length === 0}>
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
          <DialogTitle>Webhook Secret 已创建</DialogTitle>
          <DialogDescription>此 Secret 只显示一次，请立即保存。</DialogDescription>
        </DialogHeader>
        <Alert>
          <WebhookIcon className="size-4" />
          <AlertTitle>此 Secret 只显示一次，请立即保存</AlertTitle>
          <AlertDescription>后续请求会使用它生成 HMAC-SHA256 签名。</AlertDescription>
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

export function WebhooksPageClient() {
  const webhooks = useSWR("/api/webhooks", fetchWebhooks);
  const [secret, setSecret] = useState<string | null>(null);

  async function deleteWebhook(webhook: WebhookListItem) {
    if (!window.confirm("确定删除这个 Webhook 吗？")) {
      return;
    }

    try {
      const response = await fetch(`/api/webhooks/${encodeURIComponent(webhook.id)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as ApiPayload<{ deleted: boolean }>;

      if (!response.ok || payload.error || !payload.data?.deleted) {
        throw new Error(payload.error?.message ?? "删除 Webhook 失败");
      }

      toast.success("Webhook 已删除");
      await webhooks.mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除 Webhook 失败");
    }
  }

  async function testWebhook(webhook: WebhookListItem) {
    try {
      const response = await fetch(`/api/webhooks/${encodeURIComponent(webhook.id)}/test`, {
        method: "POST",
      });
      const payload = (await response.json()) as ApiPayload<{ ok: boolean; statusCode: number | null }>;

      if (!response.ok || payload.error || !payload.data) {
        throw new Error(payload.error?.message ?? "测试 Webhook 失败");
      }

      toast[payload.data.ok ? "success" : "error"](
        payload.data.ok ? "测试发送成功" : `测试发送失败：HTTP ${payload.data.statusCode ?? "无响应"}`,
      );
      await webhooks.mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "测试 Webhook 失败");
    }
  }

  const items = webhooks.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">Webhooks</h1>
          <p className="text-sm text-muted-foreground">把会议事件推送到第三方系统。</p>
        </div>
        <WebhookDialog onSaved={() => void webhooks.mutate()} onCreated={setSecret} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>已配置的 Webhook</CardTitle>
          <CardDescription>Secret 只在创建后显示一次，列表不会返回。</CardDescription>
        </CardHeader>
        <CardContent>
          {webhooks.isLoading ? (
            <div className="grid gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              暂无 Webhook
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>事件</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最近发送</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="max-w-xs truncate font-medium">{webhook.url}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="secondary">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={webhook.isActive ? "default" : "outline"}>
                        {webhook.isActive ? "启用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell>{statusLabel(webhook)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => void testWebhook(webhook)}>
                          <Send className="size-4" />
                          测试
                        </Button>
                        <WebhookDialog webhook={webhook} onSaved={() => void webhooks.mutate()} />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => void deleteWebhook(webhook)}
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
