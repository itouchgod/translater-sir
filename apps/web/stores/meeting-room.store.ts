import type { ConnectionState } from "@/types/websocket";
import type { SubtitleDisplayMode, SubtitleFontSize } from "@/types/subtitle";
import { create } from "zustand";

export type MeetingRoomStatus = "idle" | "connecting" | "live" | "paused" | "ending" | "ended";

type MeetingRoomState = {
  status: MeetingRoomStatus;
  connectionState: ConnectionState;
  isRecording: boolean;
  ttsEnabled: boolean;
  displayMode: SubtitleDisplayMode;
  fontSize: SubtitleFontSize;
  onlineCount: number;
  setStatus: (status: MeetingRoomStatus) => void;
  setConnectionState: (state: ConnectionState) => void;
  setRecording: (isRecording: boolean) => void;
  setTtsEnabled: (enabled: boolean) => void;
  setDisplayMode: (mode: SubtitleDisplayMode) => void;
  setFontSize: (fontSize: SubtitleFontSize) => void;
  setOnlineCount: (count: number) => void;
  reset: () => void;
};

const initialState = {
  status: "idle" as const,
  connectionState: "connecting" as const,
  isRecording: false,
  ttsEnabled: true,
  displayMode: "both" as const,
  fontSize: "lg" as const,
  onlineCount: 1,
};

export const useMeetingRoomStore = create<MeetingRoomState>((set) => ({
  ...initialState,
  setStatus: (status) => set({ status }),
  setConnectionState: (connectionState) => set({ connectionState }),
  setRecording: (isRecording) => set({ isRecording }),
  setTtsEnabled: (ttsEnabled) => set({ ttsEnabled }),
  setDisplayMode: (displayMode) => set({ displayMode }),
  setFontSize: (fontSize) => set({ fontSize }),
  setOnlineCount: (onlineCount) => set({ onlineCount }),
  reset: () => set(initialState),
}));
