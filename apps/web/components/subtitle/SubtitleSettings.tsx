"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_SUBTITLE_SETTINGS,
  type SubtitleDisplayMode,
  type SubtitleFontSize,
  type SubtitlePosition,
  type SubtitleSettings as SubtitleSettingsValue,
} from "@/types/subtitle";
import { cn } from "@/lib/utils";

type SubtitleSettingsProps = {
  value?: SubtitleSettingsValue;
  onChange?: (settings: SubtitleSettingsValue) => void;
  className?: string;
};

const STORAGE_KEY = "subtitle-settings";

function readSettings() {
  if (typeof window === "undefined") {
    return DEFAULT_SUBTITLE_SETTINGS;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return DEFAULT_SUBTITLE_SETTINGS;
  }

  try {
    return {
      ...DEFAULT_SUBTITLE_SETTINGS,
      ...(JSON.parse(raw) as Partial<SubtitleSettingsValue>),
    };
  } catch {
    return DEFAULT_SUBTITLE_SETTINGS;
  }
}

export function SubtitleSettings({ value, onChange, className }: SubtitleSettingsProps) {
  const [settings, setSettings] = useState<SubtitleSettingsValue>(value ?? DEFAULT_SUBTITLE_SETTINGS);

  useEffect(() => {
    const stored = value ?? readSettings();
    setSettings(stored);
    onChange?.(stored);
  }, [onChange, value]);

  function updateSettings(next: Partial<SubtitleSettingsValue>) {
    const merged = {
      ...settings,
      ...next,
    };

    setSettings(merged);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    onChange?.(merged);
  }

  return (
    <section className={cn("grid gap-4 rounded-md border bg-white p-4 md:grid-cols-3", className)}>
      <div className="grid gap-2">
        <Label>显示模式</Label>
        <Select
          value={settings.mode}
          onValueChange={(mode) => {
            updateSettings({ mode: mode as SubtitleDisplayMode });
          }}
        >
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
        <Select
          value={settings.fontSize}
          onValueChange={(fontSize) => {
            updateSettings({ fontSize: fontSize as SubtitleFontSize });
          }}
        >
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

      <div className="grid gap-2">
        <Label>位置</Label>
        <Select
          value={settings.position}
          onValueChange={(position) => {
            updateSettings({ position: position as SubtitlePosition });
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bottom">底部</SelectItem>
            <SelectItem value="top">顶部</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
