"use client";

import { Pause, Play, Square, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useTtsPlayer, type UseTtsPlayerReturn } from "@/hooks/useTtsPlayer";
import { cn } from "@/lib/utils";

type TtsControlsProps = {
  player?: UseTtsPlayerReturn;
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  className?: string;
  previewText?: string;
  previewLanguage?: string;
};

function PlaybackState({ isPlaying }: { isPlaying: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
        isPlaying ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600",
      )}
    >
      {isPlaying ? <Play className="size-3" /> : <Pause className="size-3" />}
      {isPlaying ? "播放中" : "待机"}
    </span>
  );
}

export function TtsControls({
  player: externalPlayer,
  enabled,
  onEnabledChange,
  className,
  previewText,
  previewLanguage = "zh",
}: TtsControlsProps) {
  const internalPlayer = useTtsPlayer();
  const player = externalPlayer ?? internalPlayer;
  const [internalEnabled, setInternalEnabled] = useState(true);
  const isEnabled = enabled ?? internalEnabled;

  const displayText = player.currentText ?? previewText ?? "暂无播放内容";

  function setEnabled(next: boolean) {
    if (enabled === undefined) {
      setInternalEnabled(next);
    }

    onEnabledChange?.(next);

    if (!next) {
      player.stop();
    }
  }

  return (
    <section className={cn("space-y-4 rounded-md border bg-white p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-900">TTS</h2>
          <PlaybackState isPlaying={player.isPlaying} />
        </div>
        <Button
          type="button"
          variant={isEnabled ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setEnabled(!isEnabled);
          }}
        >
          {isEnabled ? "开启" : "关闭"}
        </Button>
      </div>

      <div className="rounded-md bg-slate-950 p-3 text-sm leading-6 text-white">
        <p className={cn("line-clamp-3", !player.currentText && "text-slate-400")}>{displayText}</p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={player.toggleMute}
          disabled={!isEnabled}
          aria-label={player.isMuted ? "取消静音" : "静音"}
        >
          {player.isMuted ? <VolumeX /> : <Volume2 />}
        </Button>
        <div className="grid flex-1 gap-2">
          <Label htmlFor="tts-volume">音量</Label>
          <input
            id="tts-volume"
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(player.volume * 100)}
            disabled={!isEnabled}
            onChange={(event) => {
              player.setVolume(Number(event.currentTarget.value) / 100);
            }}
            className="h-2 w-full accent-blue-600"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!isEnabled || !previewText}
          onClick={() => {
            if (previewText) {
              player.play(previewText, previewLanguage);
            }
          }}
        >
          <Play />
          试听
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={player.stop}>
          <Square />
          停止
        </Button>
      </div>

      {player.error ? <p className="text-sm text-red-600">{player.error}</p> : null}
    </section>
  );
}
