"use client";

import {
  ErrorInfo,
  Realtime,
  type InboundMessage,
  type RealtimeChannel,
  type TokenRequest,
} from "ably";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ConnectionState, WsMessage, WsMessageHandler } from "@/types/websocket";

type UseAblyChannelOptions = {
  enabled?: boolean;
  onConnectionStateChange?: (state: ConnectionState) => void;
};

function mapConnectionState(state: string): ConnectionState {
  if (state === "connected") {
    return "connected";
  }

  if (state === "connecting" || state === "initialized") {
    return "connecting";
  }

  if (state === "failed" || state === "suspended") {
    return "failed";
  }

  return "disconnected";
}

function parseMessage(message: InboundMessage): WsMessage | null {
  const data = message.data;

  if (!data || typeof data !== "object" || !("type" in data)) {
    return null;
  }

  return data as WsMessage;
}

export function useAblyChannel(
  meetingId: string,
  onMessage: WsMessageHandler,
  options: UseAblyChannelOptions = {},
) {
  const onMessageRef = useRef(onMessage);
  const onConnectionStateChangeRef = useRef(options.onConnectionStateChange);
  const enabled = options.enabled ?? true;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientRef = useRef<Realtime | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectionStateChangeRef.current = options.onConnectionStateChange;
  }, [onMessage, options.onConnectionStateChange]);

  useEffect(() => {
    if (!meetingId || !enabled) {
      setConnectionState("disconnected");
      return;
    }

    let disposed = false;
    const client = new Realtime({
      authCallback: async (_tokenParams, callback) => {
        try {
          const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/ws-token`, {
            method: "POST",
          });
          const payload = (await response.json()) as {
            data: TokenRequest | null;
            error: { message: string } | null;
          };

          if (!response.ok || payload.error || !payload.data) {
            callback(
              new ErrorInfo(payload.error?.message ?? "Ably token request failed", 40100, response.status),
              null,
            );
            return;
          }

          callback(null, payload.data);
        } catch (error: unknown) {
          callback(
            new ErrorInfo(error instanceof Error ? error.message : "Ably token request failed", 40100, 500),
            null,
          );
        }
      },
      autoConnect: true,
    });
    const channel = client.channels.get(`meeting:${meetingId}`);
    clientRef.current = client;
    channelRef.current = channel;

    const updateState = (state: ConnectionState) => {
      if (disposed) {
        return;
      }

      setConnectionState(state);
      onConnectionStateChangeRef.current?.(state);
    };

    const connectionListener = (stateChange: { current: string; reason?: ErrorInfo }) => {
      updateState(mapConnectionState(stateChange.current));
    };
    const messageListener = (message: InboundMessage) => {
      const parsed = parseMessage(message);

      if (parsed) {
        onMessageRef.current(parsed);
      }
    };

    client.connection.on(connectionListener);
    void channel.subscribe(messageListener).catch(() => updateState("failed"));

    return () => {
      disposed = true;
      channel.unsubscribe(messageListener);
      client.connection.off(connectionListener);
      channelRef.current = null;
      clientRef.current = null;
      client.close();
    };
  }, [enabled, meetingId]);

  const publish = useCallback(
    async (message: WsMessage) => {
      const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/test-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });
      const payload = (await response.json()) as {
        error: { message: string } | null;
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.error?.message ?? "消息发送失败");
      }
    },
    [meetingId],
  );

  return {
    publish,
    connectionState,
  };
}
