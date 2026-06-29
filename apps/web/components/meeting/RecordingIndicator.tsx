"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type RecordingIndicatorProps = {
  isRecording: boolean;
  isPaused?: boolean;
  isUploading: boolean;
  uploadProgress: number;
  durationMs: number;
  estimatedSizeBytes: number;
  warning?: string | null;
  error?: string | null;
  onRetry?: () => void;
};

function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function RecordingIndicator({
  isRecording,
  isPaused = false,
  isUploading,
  uploadProgress,
  durationMs,
  estimatedSizeBytes,
  warning,
  error,
  onRetry,
}: RecordingIndicatorProps) {
  if (!isRecording && !isUploading && !error && !warning) {
    return null;
  }

  return (
    <div className="rounded-md border bg-white p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {isRecording ? (
            <span className="relative flex size-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
              <span className="relative inline-flex size-3 rounded-full bg-red-600" />
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="font-medium">
              {isUploading ? "录音上传中" : isRecording ? (isPaused ? "录音已暂停" : "录音中") : "录音"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDuration(durationMs)} · 约 {formatBytes(estimatedSizeBytes)}
            </p>
          </div>
        </div>
        {error && onRetry ? (
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            <RotateCcw className="size-4" />
            重试
          </Button>
        ) : null}
      </div>

      {isUploading ? <Progress className="mt-3" value={uploadProgress} /> : null}
      {warning ? <p className="mt-2 text-xs text-amber-700">{warning}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
