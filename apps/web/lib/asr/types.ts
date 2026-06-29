export type AsrProvider = "deepgram" | "openai-whisper" | "google-speech";

export type TranscriptResult = {
  text: string;
  isFinal: boolean;
  language: string;
  confidence?: number;
  startMs: number;
  endMs: number;
  provider: AsrProvider;
  model: string;
  requestId?: string;
  receivedAt: number;
};

export type AsrConfig = {
  provider: AsrProvider;
  language: string;
  model?: string;
  sampleRate?: number;
  maxReconnects?: number;
  onTranscript: (result: TranscriptResult) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
};

export type AsrStream = {
  sendAudio(chunk: Buffer): Promise<void>;
  close(): void;
};
