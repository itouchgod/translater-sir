"use client";

import { useEffect, useMemo, useRef } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useSubtitleStore } from "@/stores/subtitle.store";
import type { Subtitle, SubtitleDisplayMode, SubtitleFontSize } from "@/types/subtitle";
import { cn } from "@/lib/utils";

type SubtitleDisplayProps = {
  meetingId: string;
  mode: SubtitleDisplayMode;
  fontSize: SubtitleFontSize;
  maxLines?: number;
  className?: string;
};

type SegmentsResponse = {
  data: {
    items: Subtitle[];
    nextCursor: number | null;
    hasMore: boolean;
  } | null;
  error: { message: string } | null;
};

const fontSizeClass: Record<SubtitleFontSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
};

function renderSubtitleText(subtitle: Subtitle, mode: SubtitleDisplayMode) {
  if (mode === "original") {
    return <p className="text-slate-100">{subtitle.text}</p>;
  }

  if (mode === "translation") {
    return <p className="text-white">{subtitle.translation ?? subtitle.text}</p>;
  }

  return (
    <div className="space-y-1">
      <p className="text-sm text-slate-400">{subtitle.text}</p>
      <p className="text-white">{subtitle.translation ?? ""}</p>
    </div>
  );
}

export function SubtitleDisplay({
  meetingId,
  mode,
  fontSize,
  maxLines = 5,
  className,
}: SubtitleDisplayProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const subtitles = useSubtitleStore((state) => state.subtitles);
  const pendingSubtitle = useSubtitleStore((state) => state.pendingSubtitle);
  const addSubtitle = useSubtitleStore((state) => state.addSubtitle);
  const updatePending = useSubtitleStore((state) => state.updatePending);
  const updateTranslation = useSubtitleStore((state) => state.updateTranslation);
  const hydrateSubtitles = useSubtitleStore((state) => state.hydrateSubtitles);
  const clearSubtitles = useSubtitleStore((state) => state.clearSubtitles);

  const websocket = useWebSocket(meetingId);

  useEffect(() => {
    let disposed = false;

    void (async () => {
      const response = await fetch(
        `/api/meetings/${encodeURIComponent(meetingId)}/segments?limit=100`,
      );
      const payload = (await response.json()) as SegmentsResponse;

      if (!disposed && response.ok && payload.data) {
        hydrateSubtitles(payload.data.items);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [hydrateSubtitles, meetingId]);

  useEffect(() => {
    return websocket.onSubtitle((payload) => {
      const currentMaxSequence = useSubtitleStore
        .getState()
        .subtitles.reduce((max, subtitle) => Math.max(max, subtitle.sequence), 0);
      const subtitle: Subtitle = {
        id: payload.segmentId,
        text: payload.text,
        translation: null,
        isFinal: payload.isFinal,
        language: payload.language,
        timestamp: payload.timestamp,
        sequence: currentMaxSequence + 1,
      };

      if (payload.isFinal) {
        addSubtitle(subtitle);
      } else {
        updatePending(subtitle);
      }
    });
  }, [addSubtitle, updatePending, websocket]);

  useEffect(() => {
    return websocket.onTranslation((payload) => {
      updateTranslation(payload.segmentId, payload.translatedText, payload.originalText);
    });
  }, [updateTranslation, websocket]);

  useEffect(() => {
    const message = websocket.lastMessage;

    if (message?.type !== "meeting:status") {
      return;
    }

    if (["PROCESSING", "COMPLETED", "FAILED"].includes(message.data.status)) {
      clearSubtitles();
    }
  }, [clearSubtitles, websocket.lastMessage]);

  const visibleSubtitles = useMemo(() => {
    const finalSubtitles = subtitles.slice(-maxLines);

    if (!pendingSubtitle) {
      return finalSubtitles;
    }

    return [...finalSubtitles.slice(-(maxLines - 1)), pendingSubtitle];
  }, [maxLines, pendingSubtitle, subtitles]);

  useEffect(() => {
    const element = scrollRef.current;

    if (!element || !isAtBottomRef.current) {
      return;
    }

    element.scrollTo({
      top: element.scrollHeight,
      behavior: "smooth",
    });
  }, [visibleSubtitles]);

  const isWaitingForSpeech = visibleSubtitles.length === 0;

  return (
    <div
      ref={scrollRef}
      onScroll={(event) => {
        const element = event.currentTarget;
        isAtBottomRef.current =
          element.scrollHeight - element.scrollTop - element.clientHeight < 24;
      }}
      className={cn(
        "max-h-full overflow-y-auto bg-slate-950 p-4 text-white",
        fontSizeClass[fontSize],
        className,
      )}
      aria-live="polite"
    >
      {isWaitingForSpeech ? (
        <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
          <div className="max-w-md space-y-3">
            <p className="text-base font-medium text-slate-100">等待语音输入</p>
            <p className="text-sm leading-6 text-slate-400">
              麦克风开始采集后，识别到的人声会在这里实时显示。请保持浏览器麦克风权限开启，并对着当前输入设备讲话。
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleSubtitles.map((subtitle) => (
            <div
              key={subtitle.id}
              className={cn(
                "rounded-md px-3 py-2 transition-opacity duration-200 ease-out",
                subtitle.isFinal
                  ? "opacity-100"
                  : "bg-white/5 opacity-60 italic text-slate-300",
              )}
            >
              {renderSubtitleText(subtitle, mode)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
