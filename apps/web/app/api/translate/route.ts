import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requireOrgMember } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";
import { translateText } from "@/lib/translation";
import { withRateLimit } from "@/lib/with-rate-limit";
import { isSupportedLanguagePair } from "@/utils/languages";

export const runtime = "nodejs";

const TranslateSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  sourceLanguage: z.string().trim().min(2).max(12),
  targetLanguage: z.string().trim().min(2).max(12),
  meetingId: z.string().trim().min(1),
});

export const POST = withRateLimit("api:translate")(
  withApiHandler(async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    throw new AppError("TRANSLATION_UNAVAILABLE", "翻译服务暂不可用，请稍后再试", 503);
  }

  const session = await requireAuth();
  const body = TranslateSchema.safeParse(await request.json());

  if (!body.success) {
    throw new ValidationError("翻译请求无效");
  }

  if (!isSupportedLanguagePair(body.data.sourceLanguage, body.data.targetLanguage)) {
    throw new ValidationError("不支持该语言对");
  }

  const meeting = await db.meeting.findUnique({
    where: { id: body.data.meetingId },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!meeting) {
    throw new NotFoundError("会议不存在");
  }

  await requireOrgMember(meeting.organizationId);

  const result = await translateText({
    ...body.data,
    userId: session.user.id,
  });

  return apiSuccess({
    translatedText: result.translatedText,
    matchedTerms: result.matchedTerms,
    cached: result.cached,
    latencyMs: result.latencyMs,
  });
  }),
);
