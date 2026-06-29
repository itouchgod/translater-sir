"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AudioVisualizer } from "@/components/meeting/AudioVisualizer";
import { ConnectionStatus } from "@/components/meeting/ConnectionStatus";
import { MeetingControls } from "@/components/meeting/MeetingControls";
import { MeetingHeader } from "@/components/meeting/MeetingHeader";
import { RecordingIndicator } from "@/components/meeting/RecordingIndicator";
import { Button } from "@/components/ui/button";
import { SubtitleDisplay } from "@/components/subtitle/SubtitleDisplay";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import { useMeeting, type MeetingDetail } from "@/hooks/useMeeting";
import { useTtsPlayer } from "@/hooks/useTtsPlayer";
import { useWebSocket } from "@/hooks/useWebSocket";
import { cn } from "@/lib/utils";
import { useMeetingRoomStore } from "@/stores/meeting-room.store";
import type { SubtitleDisplayMode, SubtitleFontSize, SubtitleSettings } from "@/types/subtitle";

type MeetingRoomProps = {
  initialMeeting: MeetingDetail;
  canControlMic: boolean;
};

const SUBTITLE_SETTINGS_KEY = "subtitle-settings";

function readSubtitleSettings(): Pick<SubtitleSettings, "mode" | "fontSize"> | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SUBTITLE_SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as Pick<SubtitleSettings, "mode" | "fontSize">) : null;
  } catch {
    return null;
  }
}

async function postMeetingLifecycle(meetingId: string, action: "start" | "end") {
  const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/${action}`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(action === "start" ? "会议启动失败" : "会议结束失败");
  }
}

export function MeetingRoom({ initialMeeting, canControlMic }: MeetingRoomProps) {
  const router = useRouter();
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const startedRef = useRef(false);
  const microphoneRequestedRef = useRef(false);
  const endingRequestedRef = useRef(false);

  const meeting = useMeeting(initialMeeting.id);
  const data = meeting.data ?? initialMeeting;
  const audio = useAudioCapture(data.id);
  const mediaRecorder = useMediaRecorder(data.id);
  const ttsPlayer = useTtsPlayer();
  const { start: startAudio, stop: stopAudio, isCapturing, isPaused, audioLevel } = audio;
  const { start: startRecording, stop: stopRecording } = mediaRecorder;
  const { play: playTts, stop: stopTts } = ttsPlayer;
  const setStatus = useMeetingRoomStore((state) => state.setStatus);
  const setConnectionState = useMeetingRoomStore((state) => state.setConnectionState);
  const setRecording = useMeetingRoomStore((state) => state.setRecording);
  const ttsEnabled = useMeetingRoomStore((state) => state.ttsEnabled);
  const setTtsEnabled = useMeetingRoomStore((state) => state.setTtsEnabled);
  const displayMode = useMeetingRoomStore((state) => state.displayMode);
  const setDisplayMode = useMeetingRoomStore((state) => state.setDisplayMode);
  const fontSize = useMeetingRoomStore((state) => state.fontSize);
  const setFontSize = useMeetingRoomStore((state) => state.setFontSize);
  const onlineCount = useMeetingRoomStore((state) => state.onlineCount);
  const resetRoom = useMeetingRoomStore((state) => state.reset);
  const roomStatus = useMeetingRoomStore((state) => state.status);
  const socket = useWebSocket(data.id, {
    onConnectionStateChange: setConnectionState,
  });

  const audioControls = useMemo(
    () => ({
      start: audio.start,
      stop: audio.stop,
      pause: audio.pause,
      resume: audio.resume,
      isCapturing: audio.isCapturing,
      isPaused: audio.isPaused,
      error: audio.error,
    }),
    [audio.error, audio.isCapturing, audio.isPaused, audio.pause, audio.resume, audio.start, audio.stop],
  );

  useEffect(() => {
    const stored = readSubtitleSettings();

    if (stored?.mode) {
      setDisplayMode(stored.mode);
    }

    if (stored?.fontSize) {
      setFontSize(stored.fontSize);
    }
  }, [setDisplayMode, setFontSize]);

  useEffect(() => {
    if (data.status === "LIVE") {
      setStatus(isPaused ? "paused" : "live");
      return;
    }

    if (data.status === "PROCESSING") {
      setStatus("ending");
      return;
    }

    if (data.status === "COMPLETED" || data.status === "FAILED") {
      setStatus("ended");
      return;
    }

    setStatus("idle");
  }, [data.status, isPaused, setStatus]);

  useEffect(() => {
    setRecording(isCapturing);
  }, [isCapturing, setRecording]);

  useEffect(() => {
    if (!canControlMic || data.status !== "SCHEDULED" || startedRef.current) {
      return;
    }

    startedRef.current = true;
    void postMeetingLifecycle(data.id, "start")
      .then(() => meeting.mutate())
      .catch(() => {
        startedRef.current = false;
      });
  }, [canControlMic, data.id, data.status, meeting]);

  useEffect(() => {
    if (!canControlMic || data.status !== "LIVE" || microphoneRequestedRef.current) {
      return;
    }

    microphoneRequestedRef.current = true;
    void startAudio();
    void startRecording();
  }, [canControlMic, data.status, startAudio, startRecording]);

  useEffect(() => {
    return socket.onTranslation((payload) => {
      if (!ttsEnabled) {
        return;
      }

      playTts(payload.translatedText, payload.targetLanguage);
    });
  }, [playTts, socket, ttsEnabled]);

  useEffect(() => {
    if (!endingRequestedRef.current) {
      return;
    }

    if (data.status === "COMPLETED" || data.status === "FAILED") {
      router.push(`/meetings/${data.id}`);
    }
  }, [data.id, data.status, router]);

  useEffect(() => {
    return () => {
      stopAudio();
      stopTts();
      resetRoom();
    };
  }, [resetRoom, stopAudio, stopTts]);

  async function endMeeting() {
    endingRequestedRef.current = true;
    stopAudio();
    stopTts();
    setStatus("ending");
    await stopRecording().catch(() => null);
    await postMeetingLifecycle(data.id, "end");
    await meeting.mutate();
  }

  const controls = (
    <MeetingControls
      canControlMic={canControlMic}
      isEnding={roomStatus === "ending"}
      audio={audioControls}
      ttsPlayer={ttsPlayer}
      ttsEnabled={ttsEnabled}
      displayMode={displayMode}
      fontSize={fontSize}
      onTtsEnabledChange={setTtsEnabled}
      onDisplayModeChange={(mode: SubtitleDisplayMode) => {
        setDisplayMode(mode);
      }}
      onFontSizeChange={(nextFontSize: SubtitleFontSize) => {
        setFontSize(nextFontSize);
      }}
      onEndMeeting={endMeeting}
    />
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-100 text-slate-950">
      <MeetingHeader
        title={data.title}
        status={data.status}
        startedAt={data.startedAt}
        endedAt={data.endedAt}
        onlineCount={onlineCount}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[3fr_1fr]">
        <main className="flex min-h-0 flex-1 flex-col pb-24 lg:pb-0">
          <div className="min-h-0 flex-1">
            <SubtitleDisplay
              meetingId={data.id}
              mode={displayMode}
              fontSize={fontSize}
              maxLines={8}
              className={cn(
                "h-full min-h-[420px] rounded-none",
                displayMode === "both" && "leading-relaxed",
              )}
            />
          </div>
          <div className="border-t bg-white p-3">
            <AudioVisualizer audioLevel={canControlMic ? audioLevel : 0} className="h-20 w-full bg-white" />
          </div>
        </main>

        <aside className="hidden min-h-0 overflow-y-auto border-l bg-slate-50 p-4 lg:block">
          <div className="space-y-4">
            <ConnectionStatus state={socket.connectionState} transport={socket.transport} />
            {canControlMic ? (
              <RecordingIndicator
                isRecording={mediaRecorder.isRecording}
                isPaused={mediaRecorder.isPaused}
                isUploading={mediaRecorder.isUploading}
                uploadProgress={mediaRecorder.uploadProgress}
                durationMs={mediaRecorder.durationMs}
                estimatedSizeBytes={mediaRecorder.estimatedSizeBytes}
                warning={mediaRecorder.warning}
                error={mediaRecorder.error}
                onRetry={() => void mediaRecorder.retry()}
              />
            ) : null}
            {controls}
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-white p-3 shadow-lg lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <ConnectionStatus state={socket.connectionState} transport={socket.transport} />
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={mobileControlsOpen ? "关闭控制面板" : "打开控制面板"}
            onClick={() => setMobileControlsOpen((open) => !open)}
          >
            {mobileControlsOpen ? <X /> : <SlidersHorizontal />}
          </Button>
        </div>
      </div>

      {mobileControlsOpen ? (
        <div className="fixed inset-x-0 bottom-20 z-50 max-h-[70svh] overflow-y-auto border-t bg-slate-50 p-4 shadow-2xl lg:hidden">
          {canControlMic ? (
            <div className="mb-4">
              <RecordingIndicator
                isRecording={mediaRecorder.isRecording}
                isPaused={mediaRecorder.isPaused}
                isUploading={mediaRecorder.isUploading}
                uploadProgress={mediaRecorder.uploadProgress}
                durationMs={mediaRecorder.durationMs}
                estimatedSizeBytes={mediaRecorder.estimatedSizeBytes}
                warning={mediaRecorder.warning}
                error={mediaRecorder.error}
                onRetry={() => void mediaRecorder.retry()}
              />
            </div>
          ) : null}
          {controls}
        </div>
      ) : null}
    </div>
  );
}
