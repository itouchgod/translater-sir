"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAblyChannel } from "@/hooks/useAblyChannel";
import type {
  ConnectionState,
  SubtitlePayload,
  TranslationPayload,
  WsMessage,
} from "@/types/websocket";

type Handler<TPayload> = (payload: TPayload) => void;

type UseWebSocketOptions = {
  onConnectionStateChange?: (state: ConnectionState) => void;
};

function useSseChannel(
  meetingId: string,
  onMessage: (message: WsMessage) => void,
  onConnectionStateChange?: (state: ConnectionState) => void,
  enabled = true,
) {
  const onMessageRef = useRef(onMessage);
  const onConnectionStateChangeRef = useRef(onConnectionStateChange);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectionStateChangeRef.current = onConnectionStateChange;
  }, [onMessage, onConnectionStateChange]);

  useEffect(() => {
    if (!meetingId || !enabled) {
      setConnectionState("disconnected");
      return;
    }

    setConnectionState("connecting");
    onConnectionStateChangeRef.current?.("connecting");

    const source = new EventSource(`/api/meetings/${encodeURIComponent(meetingId)}/stream`);

    source.addEventListener("connected", () => {
      setConnectionState("connected");
      onConnectionStateChangeRef.current?.("connected");
    });
    source.addEventListener("message", (event) => {
      onMessageRef.current(JSON.parse(event.data) as WsMessage);
    });
    source.addEventListener("error", () => {
      setConnectionState("disconnected");
      onConnectionStateChangeRef.current?.("disconnected");
    });

    return () => {
      source.close();
      setConnectionState("disconnected");
      onConnectionStateChangeRef.current?.("disconnected");
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

  return { publish, connectionState };
}

export function useWebSocket(meetingId: string, options: UseWebSocketOptions = {}) {
  const subtitleHandlersRef = useRef(new Set<Handler<SubtitlePayload>>());
  const translationHandlersRef = useRef(new Set<Handler<TranslationPayload>>());
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const useAbly = Boolean(process.env.NEXT_PUBLIC_ABLY_CLIENT_KEY);

  const handleMessage = useCallback((message: WsMessage) => {
    setLastMessage(message);

    if (message.type === "subtitle") {
      for (const handler of subtitleHandlersRef.current) {
        handler(message.data);
      }
    }

    if (message.type === "translation") {
      for (const handler of translationHandlersRef.current) {
        handler(message.data);
      }
    }
  }, []);

  const ablyChannel = useAblyChannel(meetingId, handleMessage, {
    enabled: useAbly,
    onConnectionStateChange: options.onConnectionStateChange,
  });
  const effectiveUseAbly = useAbly && ablyChannel.connectionState !== "failed";
  const sseChannel = useSseChannel(
    meetingId,
    handleMessage,
    options.onConnectionStateChange,
    !effectiveUseAbly,
  );
  const channel = effectiveUseAbly ? ablyChannel : sseChannel;

  const onSubtitle = useCallback((handler: Handler<SubtitlePayload>) => {
    subtitleHandlersRef.current.add(handler);

    return () => {
      subtitleHandlersRef.current.delete(handler);
    };
  }, []);

  const onTranslation = useCallback((handler: Handler<TranslationPayload>) => {
    translationHandlersRef.current.add(handler);

    return () => {
      translationHandlersRef.current.delete(handler);
    };
  }, []);

  const sendSubtitle = useCallback(
    (payload: SubtitlePayload) => channel.publish({ type: "subtitle", data: payload }),
    [channel],
  );

  const sendTranslation = useCallback(
    (payload: TranslationPayload) => channel.publish({ type: "translation", data: payload }),
    [channel],
  );

  return useMemo(
    () => ({
      sendSubtitle,
      sendTranslation,
      onSubtitle,
      onTranslation,
      connectionState: channel.connectionState,
      transport: effectiveUseAbly ? "ably" : "sse",
      lastMessage,
    }),
    [
      channel.connectionState,
      lastMessage,
      onSubtitle,
      onTranslation,
      sendSubtitle,
      sendTranslation,
      effectiveUseAbly,
    ],
  );
}
