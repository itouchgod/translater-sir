export type TtsProvider = "openai" | "elevenlabs" | "azure-tts" | "google-tts";

export type TtsOptions = {
  provider?: TtsProvider;
  voice?: string;
  speed?: number;
  volume?: number;
  userId?: string;
};

export type SynthesizeSpeechParams = {
  text: string;
  language: string;
  options?: TtsOptions;
};

export type SynthesizeSpeechResult = {
  audio: ArrayBuffer;
  provider: TtsProvider;
  model: string;
  voice: string;
  cached: boolean;
  latencyMs: number;
};
