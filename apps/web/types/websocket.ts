import type { MeetingStatus } from "@prisma/client";

export type ConnectionState = "connected" | "connecting" | "disconnected" | "failed";

export type WsEvent = WsMessage["type"];

export type WsMessage =
  | { type: "subtitle"; data: SubtitlePayload }
  | { type: "translation"; data: TranslationPayload }
  | { type: "meeting:status"; data: MeetingStatusPayload }
  | { type: "audio:chunk"; data: AudioChunkPayload }
  | { type: "error"; data: ErrorPayload }
  | { type: "ping" }
  | { type: "pong" };

export type SubtitlePayload = {
  segmentId: string;
  text: string;
  isFinal: boolean;
  language: string;
  timestamp: number;
};

export type TranslationPayload = {
  segmentId: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
};

export type MeetingStatusPayload = {
  meetingId: string;
  status: MeetingStatus;
  timestamp: number;
};

export type AudioChunkPayload = {
  meetingId: string;
  chunkId: string;
  data: string;
  mimeType: string;
  timestamp: number;
};

export type ErrorPayload = {
  code: string;
  message: string;
  recoverable?: boolean;
};

export type WsMessageHandler<TMessage extends WsMessage = WsMessage> = (message: TMessage) => void;
