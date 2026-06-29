import OpenAI from "openai";
import { getLanguageLabel } from "@/utils/languages";
import type { TranslationRequest, TranslationResult } from "@/lib/translation/types";

const OPENAI_TRANSLATION_MODEL = "gpt-4o-mini";
const OPENAI_TIMEOUT_MS = 5000;

let openai: OpenAI | null = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  openai ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: OPENAI_TIMEOUT_MS,
    maxRetries: 0,
  });

  return openai;
}

function buildSystemPrompt(request: TranslationRequest) {
  const terms = request.matchedTerms ?? [];
  const termPrompt =
    terms.length > 0
      ? `\n遇到以下词语请使用指定译文：\n${terms
          .map((term) => `${term.source} => ${term.target}`)
          .join("\n")}`
      : "";

  return `你是专业同声传译，保持简洁，不解释，只输出译文。${termPrompt}`;
}

export async function translate(request: TranslationRequest): Promise<TranslationResult> {
  const startedAt = Date.now();
  const client = getOpenAIClient();
  const response = await client.chat.completions.create(
    {
      model: OPENAI_TRANSLATION_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(request),
        },
        {
          role: "user",
          content: `请将以下${getLanguageLabel(request.sourceLanguage)}内容翻译为${getLanguageLabel(
            request.targetLanguage,
          )}：\n${request.text}`,
        },
      ],
    },
    {
      timeout: OPENAI_TIMEOUT_MS,
    },
  );
  const translatedText = response.choices[0]?.message.content?.trim() ?? "";

  if (!translatedText) {
    throw new Error("OpenAI returned an empty translation");
  }

  return {
    translatedText,
    matchedTerms: request.matchedTerms ?? [],
    cached: false,
    latencyMs: Date.now() - startedAt,
    provider: "openai",
    model: response.model || OPENAI_TRANSLATION_MODEL,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}
