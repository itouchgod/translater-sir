import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth-helpers";
import { AppError, ValidationError } from "@/lib/errors";
import { synthesizeSpeech } from "@/lib/tts";
import { isSupportedLanguage } from "@/utils/languages";

export const runtime = "nodejs";

const ONE_MB = 1024 * 1024;

const TtsRequestSchema = z.object({
  text: z.string().trim().min(1).max(4096),
  language: z.string().trim().min(2).max(12),
  speed: z.number().min(0.25).max(4).default(1),
  voice: z.string().trim().min(1).max(64).optional(),
});

export const POST = withApiHandler(async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    throw new AppError("TTS_UNAVAILABLE", "语音合成服务暂不可用，请稍后再试", 503);
  }

  const session = await requireAuth();
  const body = TtsRequestSchema.safeParse(await request.json());

  if (!body.success) {
    throw new ValidationError("语音合成请求无效");
  }

  if (!isSupportedLanguage(body.data.language)) {
    throw new ValidationError("不支持该语音语言");
  }

  const result = await synthesizeSpeech({
    text: body.data.text,
    language: body.data.language,
    options: {
      provider: "openai",
      voice: body.data.voice,
      speed: body.data.speed,
      userId: session.user.id,
    },
  });

  return new Response(result.audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(result.audio.byteLength),
      "Cache-Control": result.audio.byteLength < ONE_MB ? "private, max-age=300" : "no-store",
      "X-TTS-Provider": result.provider,
      "X-TTS-Cached": String(result.cached),
      "X-TTS-Latency-Ms": String(result.latencyMs),
    },
  });
});
