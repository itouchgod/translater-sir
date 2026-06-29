import { createHash } from "crypto";
import type { AiType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { synthesize, openaiTtsDefaults } from "@/lib/tts/openai";
import type { SynthesizeSpeechParams, SynthesizeSpeechResult, TtsProvider } from "@/lib/tts/types";
import { logger } from "@/lib/logger";
import { RedisKeys } from "@/utils/redis-keys";
import { RedisTTL } from "@/utils/redis-ttl";

export type { SynthesizeSpeechParams, SynthesizeSpeechResult, TtsOptions, TtsProvider } from "@/lib/tts/types";

const TTS_LOG_TYPE = "TTS" satisfies AiType;

function createTtsHash(params: SynthesizeSpeechParams) {
  return createHash("md5")
    .update(
      JSON.stringify({
        text: params.text,
        language: params.language,
        provider: params.options?.provider ?? "openai",
        voice: params.options?.voice ?? openaiTtsDefaults.voice,
        speed: params.options?.speed ?? 1,
      }),
    )
    .digest("hex");
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("base64");
}

function base64ToArrayBuffer(value: string) {
  const buffer = Buffer.from(value, "base64");
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function writeTtsLog(params: {
  userId?: string;
  provider: TtsProvider;
  model: string;
  latencyMs: number;
  status: "SUCCESS" | "ERROR";
  metadata: Prisma.InputJsonObject;
  error?: string;
}) {
  await db.aiLog.create({
    data: {
      userId: params.userId,
      provider: params.provider,
      model: params.model,
      type: TTS_LOG_TYPE,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: params.latencyMs,
      status: params.status,
      error: params.error,
      metadata: params.metadata,
    },
  });
}

export async function synthesizeSpeech(
  params: SynthesizeSpeechParams,
): Promise<SynthesizeSpeechResult> {
  const startedAt = Date.now();
  const provider = params.options?.provider ?? "openai";
  const voice = params.options?.voice ?? openaiTtsDefaults.voice;
  const speed = params.options?.speed ?? 1;
  const hash = createTtsHash(params);
  const cacheKey = RedisKeys.ttsCache(hash);
  const cached = await redis.get(cacheKey);

  if (cached) {
    const result = {
      audio: base64ToArrayBuffer(cached),
      provider,
      model: openaiTtsDefaults.model,
      voice,
      cached: true,
      latencyMs: Date.now() - startedAt,
    } satisfies SynthesizeSpeechResult;

    await writeTtsLog({
      userId: params.options?.userId,
      provider,
      model: result.model,
      latencyMs: result.latencyMs,
      status: "SUCCESS",
      metadata: {
        cached: true,
        language: params.language,
        voice,
        speed,
        sizeBytes: result.audio.byteLength,
      },
    });

    return result;
  }

  try {
    if (provider !== "openai") {
      throw new Error(`TTS provider is not implemented: ${provider}`);
    }

    const audio = await synthesize(params.text, params.language, params.options);
    const result = {
      audio,
      provider,
      model: openaiTtsDefaults.model,
      voice,
      cached: false,
      latencyMs: Date.now() - startedAt,
    } satisfies SynthesizeSpeechResult;

    await redis.setex(cacheKey, RedisTTL.TTS_CACHE, arrayBufferToBase64(audio));
    await writeTtsLog({
      userId: params.options?.userId,
      provider,
      model: result.model,
      latencyMs: result.latencyMs,
      status: "SUCCESS",
      metadata: {
        cached: false,
        language: params.language,
        voice,
        speed,
        sizeBytes: audio.byteLength,
      },
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "TTS synthesis failed";

    await writeTtsLog({
      userId: params.options?.userId,
      provider,
      model: openaiTtsDefaults.model,
      latencyMs: Date.now() - startedAt,
      status: "ERROR",
      error: message,
      metadata: {
        cached: false,
        language: params.language,
        voice,
        speed,
      },
    }).catch((logError: unknown) => {
      logger.error({ error: logError }, "Failed to write TTS error log");
    });

    throw error;
  }
}
