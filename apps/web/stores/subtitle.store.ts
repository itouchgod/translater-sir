import { create } from "zustand";
import type { Subtitle } from "@/types/subtitle";

type SubtitleState = {
  subtitles: Subtitle[];
  pendingSubtitle: Subtitle | null;
  addSubtitle: (subtitle: Subtitle) => void;
  updatePending: (subtitle: Subtitle) => void;
  updateTranslation: (segmentId: string, translatedText: string, originalText?: string) => void;
  hydrateSubtitles: (subtitles: Subtitle[]) => void;
  clearSubtitles: () => void;
};

function sortSubtitles(subtitles: Subtitle[]) {
  return subtitles.toSorted((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }

    return left.timestamp - right.timestamp;
  });
}

export const useSubtitleStore = create<SubtitleState>((set) => ({
  subtitles: [],
  pendingSubtitle: null,

  addSubtitle: (subtitle) =>
    set((state) => {
      const finalSubtitle = {
        ...subtitle,
        isFinal: true,
      };
      const existingIndex = state.subtitles.findIndex((item) => item.id === finalSubtitle.id);
      const nextSubtitles =
        existingIndex >= 0
          ? state.subtitles.map((item, index) =>
              index === existingIndex ? { ...item, ...finalSubtitle } : item,
            )
          : [...state.subtitles, finalSubtitle];

      return {
        subtitles: sortSubtitles(nextSubtitles),
        pendingSubtitle: null,
      };
    }),

  updatePending: (subtitle) =>
    set({
      pendingSubtitle: {
        ...subtitle,
        isFinal: false,
      },
    }),

  updateTranslation: (segmentId, translatedText, originalText) =>
    set((state) => {
      const existing = state.subtitles.find((item) => item.id === segmentId);

      if (!existing && !originalText) {
        return state;
      }

      const nextSubtitles = existing
        ? state.subtitles.map((item) =>
            item.id === segmentId ? { ...item, translation: translatedText } : item,
          )
        : [
            ...state.subtitles,
            {
              id: segmentId,
              text: originalText ?? "",
              translation: translatedText,
              isFinal: true,
              language: "",
              timestamp: Date.now(),
              sequence:
                state.subtitles.reduce((max, item) => Math.max(max, item.sequence), 0) + 1,
            },
          ];

      return {
        subtitles: sortSubtitles(nextSubtitles),
      };
    }),

  hydrateSubtitles: (subtitles) =>
    set((state) => {
      const byId = new Map<string, Subtitle>();

      for (const subtitle of state.subtitles) {
        byId.set(subtitle.id, subtitle);
      }

      for (const subtitle of subtitles) {
        const existing = byId.get(subtitle.id);
        byId.set(subtitle.id, existing ? { ...existing, ...subtitle } : subtitle);
      }

      return {
        subtitles: sortSubtitles([...byId.values()]),
      };
    }),

  clearSubtitles: () =>
    set({
      subtitles: [],
      pendingSubtitle: null,
    }),
}));
