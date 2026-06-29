"use client";

import { Mic, MicOff, MonitorUp, Settings2, Square, Subtitles, Volume2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TtsControls } from "@/components/meeting/TtsControls";
import type { UseTtsPlayerReturn } from "@/hooks/useTtsPlayer";
import type { SubtitleDisplayMode, SubtitleFontSize } from "@/types/subtitle";

type AudioControls = {
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isCapturing: boolean;
  isPaused: boolean;
  error: string | null;
};

type MeetingControlsProps = {
  canControlMic: boolean;
  isEnding: boolean;
  audio: AudioControls;
  ttsPlayer: UseTtsPlayerReturn;
  ttsEnabled: boolean;
  displayMode: SubtitleDisplayMode;
  fontSize: SubtitleFontSize;
  onTtsEnabledChange: (enabled: boolean) => void;
  onDisplayModeChange: (mode: SubtitleDisplayMode) => void;
  onFontSizeChange: (fontSize: SubtitleFontSize) => void;
  onEndMeeting: () => Promise<void>;
};

export function MeetingControls({
  canControlMic,
  isEnding,
  audio,
  ttsPlayer,
  ttsEnabled,
  displayMode,
  fontSize,
  onTtsEnabledChange,
  onDisplayModeChange,
  onFontSizeChange,
  onEndMeeting,
}: MeetingControlsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="space-y-4">
      {canControlMic ? (
        <section className="space-y-3 rounded-md border bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-900">麦克风</h2>
              <p className="text-xs text-slate-500">
                {audio.isCapturing ? (audio.isPaused ? "已暂停" : "正在采集") : "未开启"}
              </p>
            </div>
            <Button
              type="button"
              variant={audio.isCapturing && !audio.isPaused ? "default" : "outline"}
              size="icon"
              aria-label={audio.isCapturing && !audio.isPaused ? "暂停麦克风" : "开启麦克风"}
              onClick={() => {
                if (!audio.isCapturing) {
                  void audio.start();
                  return;
                }

                if (audio.isPaused) {
                  audio.resume();
                } else {
                  audio.pause();
                }
              }}
            >
              {audio.isCapturing && !audio.isPaused ? <Mic /> : <MicOff />}
            </Button>
          </div>
          {audio.error ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {audio.error}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="rounded-md border bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <MonitorUp className="size-4" />
            观看模式
          </div>
          <p className="mt-1 text-sm text-slate-500">你可以观看实时字幕，麦克风控制仅主持人可用。</p>
        </section>
      )}

      <section className="space-y-4 rounded-md border bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Subtitles className="size-4" />
          字幕
        </div>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>显示模式</Label>
            <Select value={displayMode} onValueChange={(value) => onDisplayModeChange(value as SubtitleDisplayMode)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">双语</SelectItem>
                <SelectItem value="original">原文</SelectItem>
                <SelectItem value="translation">译文</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>字体大小</Label>
            <Select value={fontSize} onValueChange={(value) => onFontSizeChange(value as SubtitleFontSize)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">小</SelectItem>
                <SelectItem value="md">中</SelectItem>
                <SelectItem value="lg">大</SelectItem>
                <SelectItem value="xl">超大</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="rounded-md border bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Volume2 className="size-4" />
            语音播报
          </div>
          <Button
            type="button"
            size="sm"
            variant={ttsEnabled ? "default" : "outline"}
            onClick={() => {
              const next = !ttsEnabled;
              onTtsEnabledChange(next);
              if (!next) {
                ttsPlayer.stop();
              }
            }}
          >
            {ttsEnabled ? "开启" : "关闭"}
          </Button>
        </div>
        <TtsControls
          player={ttsPlayer}
          enabled={ttsEnabled}
          onEnabledChange={onTtsEnabledChange}
          className="border-0 p-0 shadow-none"
        />
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="destructive" className="w-full" disabled={isEnding}>
            <Square />
            结束会议
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>结束会议</DialogTitle>
            <DialogDescription>会议会进入处理中状态，并在后处理完成后跳转到详情页。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isEnding}
              onClick={() => {
                setConfirmOpen(false);
                void onEndMeeting();
              }}
            >
              {isEnding ? "结束中" : "确认结束"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="hidden items-center gap-2 text-xs text-slate-500 lg:flex">
        <Settings2 className="size-3.5" />
        控制变更会立即应用到当前会议室视图。
      </div>
    </div>
  );
}
