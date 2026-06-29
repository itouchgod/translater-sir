export type SubtitleDisplayMode = "original" | "translation" | "both";

export type SubtitleFontSize = "sm" | "md" | "lg" | "xl";

export type SubtitlePosition = "top" | "bottom";

export type Subtitle = {
  id: string;
  text: string;
  translation: string | null;
  isFinal: boolean;
  language: string;
  timestamp: number;
  sequence: number;
};

export type SubtitleSettings = {
  mode: SubtitleDisplayMode;
  fontSize: SubtitleFontSize;
  position: SubtitlePosition;
};

export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  mode: "both",
  fontSize: "md",
  position: "bottom",
};
