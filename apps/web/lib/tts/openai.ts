import OpenAI from "openai";
import type { TtsOptions } from "@/lib/tts/types";
import { getLanguageLabel } from "@/utils/languages";

const OPENAI_TTS_MODEL = "tts-1";
const DEFAULT_VOICE = "alloy";
const OPENAI_TTS_TIMEOUT_MS = 10000;

let openai: OpenAI | null = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  openai ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: OPENAI_TTS_TIMEOUT_MS,
    maxRetries: 0,
  });

  return openai;
}

function clampSpeed(speed: number | undefined) {
  if (typeof speed !== "number" || Number.isNaN(speed)) {
    return 1;
  }

  return Math.min(4, Math.max(0.25, speed));
}

export async function synthesize(
  text: string,
  language: string,
  options: TtsOptions = {},
): Promise<ArrayBuffer> {
  const client = getOpenAIClient();
  const response = await client.audio.speech.create(
    {
      model: OPENAI_TTS_MODEL,
      voice: options.voice ?? DEFAULT_VOICE,
      input: text,
      response_format: "mp3",
      speed: clampSpeed(options.speed),
    },
    {
      timeout: OPENAI_TTS_TIMEOUT_MS,
    },
  );

  const audio = await response.arrayBuffer();

  if (audio.byteLength === 0) {
    throw new Error(`OpenAI TTS returned empty audio for ${getLanguageLabel(language)}`);
  }

  return audio;
}

export const openaiTtsDefaults = {
  model: OPENAI_TTS_MODEL,
  voice: DEFAULT_VOICE,
} as const;
