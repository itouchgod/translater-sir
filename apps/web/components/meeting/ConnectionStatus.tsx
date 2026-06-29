"use client";

import { AlertCircle, CheckCircle2, Loader2, WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { ConnectionState } from "@/types/websocket";

type ConnectionStatusProps = {
  state: ConnectionState;
  transport: string;
};

function getStateView(state: ConnectionState) {
  switch (state) {
    case "connected":
      return {
        label: "已连接",
        icon: CheckCircle2,
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "connecting":
      return {
        label: "重连中",
        icon: Loader2,
        className: "bg-amber-50 text-amber-700 border-amber-200",
      };
    case "failed":
      return {
        label: "连接失败",
        icon: AlertCircle,
        className: "bg-red-50 text-red-700 border-red-200",
      };
    case "disconnected":
      return {
        label: "已断开",
        icon: WifiOff,
        className: "bg-red-50 text-red-700 border-red-200",
      };
  }
}

export function ConnectionStatus({ state, transport }: ConnectionStatusProps) {
  const view = getStateView(state);
  const Icon = view.icon;

  return (
    <div className="space-y-3">
      <Badge variant="outline" className={view.className}>
        <Icon className={state === "connecting" ? "motion-safe:animate-spin" : ""} />
        {view.label} · {transport === "ably" ? "Ably" : "SSE"}
      </Badge>

      {state !== "connected" ? (
        <Alert variant={state === "failed" || state === "disconnected" ? "destructive" : "default"}>
          <Icon className={state === "connecting" ? "motion-safe:animate-spin" : ""} />
          <AlertTitle>连接已断开，正在重连...</AlertTitle>
          <AlertDescription>实时字幕会自动恢复；如果长时间无响应，请刷新页面。</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
