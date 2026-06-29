import type { AiType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createTranslationHash, getCachedTranslation, setCachedTranslation } from "@/lib/translation/cache";
import { applyGlossary, loadGlossary } from "@/lib/translation/glossary";
import { translate } from "@/lib/translation/openai";
import type { TranslateTextParams, TranslationResult } from "@/lib/translation/types";
import { isSupportedLanguagePair } from "@/utils/languages";

const TRANSLATION_LOG_TYPE = "TRANSLATION" satisfies AiType;
const TRANSLATION_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("翻译服务响应超时"));
    }, timeoutMs);

    promise
      .then(resolve, reject)
      .finally(() => {
        clearTimeout(timeout);
      });
  });
}

function buildMetadata(params: {
  cached: boolean;
  matchedTerms: TranslationResult["matchedTerms"];
  glossarySize: number;
}): Prisma.InputJsonObject {
  const matchedCount = params.matchedTerms.reduce((total, term) => total + term.count, 0);

  return {
    cached: params.cached,
    matchedTerms: params.matchedTerms.map((term) => ({
      source: term.source,
      target: term.target,
      count: term.count,
    })),
    glossarySize: params.glossarySize,
    matchedTermCount: matchedCount,
    glossaryHitRate: params.glossarySize > 0 ? matchedCount / params.glossarySize : 0,
  };
}

async function writeTranslationLog(params: {
  meetingId: string;
  userId?: string;
  result?: TranslationResult;
  status: "SUCCESS" | "ERROR";
  latencyMs: number;
  metadata?: Prisma.InputJsonObject;
  error?: string;
}) {
  await db.aiLog.create({
    data: {
      meetingId: params.meetingId,
      userId: params.userId,
      provider: params.result?.provider ?? "openai",
      model: params.result?.model ?? "gpt-4o-mini",
      type: TRANSLATION_LOG_TYPE,
      inputTokens: params.result?.inputTokens ?? 0,
      outputTokens: params.result?.outputTokens ?? 0,
      latencyMs: params.latencyMs,
      status: params.status,
      error: params.error,
      metadata: params.metadata,
    },
  });
}

export async function translateText(params: TranslateTextParams): Promise<TranslationResult> {
  const startedAt = Date.now();

  if (!isSupportedLanguagePair(params.sourceLanguage, params.targetLanguage)) {
    throw new Error("不支持该语言对");
  }

  const meeting = await db.meeting.findUnique({
    where: { id: params.meetingId },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!meeting) {
    throw new Error("会议不存在");
  }

  const hash = createTranslationHash({
    text: params.text,
    sourceLanguage: params.sourceLanguage,
    targetLanguage: params.targetLanguage,
    orgId: meeting.organizationId,
  });
  const cached = await getCachedTranslation(hash);

  if (cached) {
    const result: TranslationResult = {
      translatedText: cached,
      matchedTerms: [],
      cached: true,
      latencyMs: Date.now() - startedAt,
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 0,
      outputTokens: 0,
    };

    await writeTranslationLog({
      meetingId: meeting.id,
      userId: params.userId,
      result,
      status: "SUCCESS",
      latencyMs: result.latencyMs,
      metadata: buildMetadata({
        cached: true,
        matchedTerms: [],
        glossarySize: 0,
      }),
    });

    return result;
  }

  const glossary = await loadGlossary(
    meeting.organizationId,
    params.sourceLanguage,
    params.targetLanguage,
  );
  const { processedText, matchedTerms } = applyGlossary(params.text, glossary);
  const metadata = buildMetadata({
    cached: false,
    matchedTerms,
    glossarySize: glossary.length,
  });

  try {
    const result = await withTimeout(
      translate({
        text: processedText,
        sourceLanguage: params.sourceLanguage,
        targetLanguage: params.targetLanguage,
        orgId: meeting.organizationId,
        meetingId: meeting.id,
        userId: params.userId,
        glossary,
        matchedTerms,
      }),
      TRANSLATION_TIMEOUT_MS,
    );

    await setCachedTranslation(hash, result.translatedText);
    await writeTranslationLog({
      meetingId: meeting.id,
      userId: params.userId,
      result,
      status: "SUCCESS",
      latencyMs: result.latencyMs,
      metadata,
    });

    return result;
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : "翻译服务调用失败";

    await writeTranslationLog({
      meetingId: meeting.id,
      userId: params.userId,
      status: "ERROR",
      latencyMs,
      metadata,
      error: message,
    }).catch((logError: unknown) => {
      logger.error({ error: logError }, "Failed to write translation error log");
    });

    throw error;
  }
}
