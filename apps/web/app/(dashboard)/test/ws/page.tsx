"use client";

import { WifiIcon, WifiOffIcon } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { ConnectionState, SubtitlePayload, WsMessage } from "@/types/websocket";

function stateLabel(state: ConnectionState) {
  switch (state) {
    case "connected":
      return "已连接";
    case "connecting":
      return "连接中";
    case "disconnected":
      return "已断开";
    case "failed":
      return "连接失败";
  }
}

export default function WebSocketTestPage() {
  const [meetingId, setMeetingId] = useState("");
  const [activeMeetingId, setActiveMeetingId] = useState("");
  const [text, setText] = useState("这是一条测试字幕");
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const socket = useWebSocket(activeMeetingId);
  const { onSubtitle } = socket;

  useEffect(() => {
    return onSubtitle((payload) => {
      const message: WsMessage = { type: "subtitle", data: payload };
      setMessages((current) => [message, ...current].slice(0, 20));
    });
  }, [onSubtitle]);

  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessages([]);
    setActiveMeetingId(meetingId.trim());
  }

  async function sendSubtitle() {
    const payload: SubtitlePayload = {
      segmentId: crypto.randomUUID(),
      text,
      isFinal: true,
      language: "zh",
      timestamp: Date.now(),
    };

    await socket.sendSubtitle(payload);
  }

  const isConnected = socket.connectionState === "connected";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">WebSocket 测试</h1>
          <p className="text-sm text-muted-foreground">验证会议实时消息订阅和服务端发布。</p>
        </div>
        <Badge variant={isConnected ? "default" : "secondary"}>
          {isConnected ? <WifiIcon data-icon="inline-start" /> : <WifiOffIcon data-icon="inline-start" />}
          {stateLabel(socket.connectionState)}
        </Badge>
      </div>

      {socket.connectionState !== "connected" ? (
        <Alert>
          <WifiOffIcon />
          <AlertTitle>{socket.connectionState === "connecting" ? "正在连接" : "实时连接不可用"}</AlertTitle>
          <AlertDescription>
            当前传输：{socket.transport === "ably" ? "Ably" : "SSE 轮询降级"}。断线后客户端会自动重连或继续轮询。
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>连接</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex gap-3" onSubmit={connect}>
            <Input
              value={meetingId}
              onChange={(event) => setMeetingId(event.target.value)}
              placeholder="Meeting ID"
            />
            <Button type="submit">连接</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>发送测试字幕</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea value={text} onChange={(event) => setText(event.target.value)} />
          <Button type="button" disabled={!activeMeetingId} onClick={() => void sendSubtitle()}>
            发送
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>收到的消息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无消息</p>
            ) : (
              messages.map((message, index) => (
                <pre key={`${message.type}-${index}`} className="overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(message, null, 2)}
                </pre>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
