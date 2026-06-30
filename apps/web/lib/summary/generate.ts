import OpenAI from "openai";
import type { AiType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  buildTranscript,
  formatDuration,
  loadSummarySource,
  parseStoredSummary,
} from "@/lib/summary/utils";
import { MeetingSummarySchema, type MeetingSummary } from "@/lib/summary/types";
import { triggerWebhooks } from "@/lib/webhook-events";

const SUMMARY_MODEL = "gpt-4o";
const SUMMARY_LOG_TYPE = "SUMMARY" satisfies AiType;
const SUMMARY_TIMEOUT_MS = 30_000;
const SUMMARY_MAX_RETRIES = 2;

let openai: OpenAI | null = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new AppError("SUMMARY_UNAVAILABLE", "纪要生成服务暂不可用，请稍后再试", 503);
  }

  openai ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: SUMMARY_TIMEOUT_MS,
    maxRetries: 0,
  });

  return openai;
}

function extractJsonObject(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

function buildPrompt(source: Awaited<ReturnType<typeof loadSummarySource>>) {
  const transcript = source.segments
    .map((segment) => {
      const translation = segment.translatedText ? `\n译文：${segment.translatedText}` : "";
      return `[${segment.sequence}] 原文：${segment.originalText}${translation}`;
    })
    .join("\n\n");

  return `你是专业会议记录员。以下是会议逐字稿（含原文和译文）。
请生成结构化会议纪要，使用严格 JSON 格式，不要输出 Markdown，不要解释：
{
  "title": "string",
  "date": "string",
  "duration": "string",
  "participants": ["string"],
  "overview": "string",
  "keyPoints": ["string"],
  "decisions": ["string"],
  "actionItems": [{ "task": "string", "owner": "string", "deadline": "string" }],
  "highlights": ["string"]
}
要求：简洁专业，不重复，突出决策和待办。若没有决策或待办，返回空数组。

会议标题：${source.meeting.title}
会议日期：${(source.meeting.startedAt ?? source.meeting.createdAt).toISOString()}
会议时长：${formatDuration(source.meeting.startedAt, source.meeting.endedAt)}

逐字稿：
${transcript || "暂无逐字稿"}`;
}

async function writeSummaryLog(params: {
  meetingId: string;
  userId?: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: "SUCCESS" | "ERROR";
  error?: string;
  metadata?: Prisma.InputJsonObject;
}) {
  await db.aiLog.create({
    data: {
      meetingId: params.meetingId,
      userId: params.userId,
      provider: "openai",
      model: SUMMARY_MODEL,
      type: SUMMARY_LOG_TYPE,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      latencyMs: params.latencyMs,
      status: params.status,
      error: params.error,
      metadata: params.metadata,
    },
  });
}

async function requestSummaryFromOpenAI(prompt: string) {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create(
    {
      model: SUMMARY_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "你只输出可解析的 JSON 对象，字段必须符合用户指定结构。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    },
    {
      timeout: SUMMARY_TIMEOUT_MS,
    },
  );
  const content = response.choices[0]?.message.content ?? "";

  if (!content.trim()) {
    throw new Error("OpenAI returned an empty summary");
  }

  return {
    content,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}

export async function generateMeetingSummary(params: {
  meetingId: string;
  userId?: string;
  force?: boolean;
}): Promise<MeetingSummary> {
  const startedAt = Date.now();
  const source = await loadSummarySource(params.meetingId);
  const existing = parseStoredSummary(source.meeting.summaryText);

  if (existing && !params.force) {
    return existing;
  }

  const transcript = buildTranscript(source.segments);
  const prompt = buildPrompt(source);
  let inputTokens = 0;
  let outputTokens = 0;
  let lastError: unknown;

  for (let attempt = 0; attempt <= SUMMARY_MAX_RETRIES; attempt += 1) {
    try {
      const result = await requestSummaryFromOpenAI(prompt);
      inputTokens += result.inputTokens;
      outputTokens += result.outputTokens;

      const rawJson = JSON.parse(extractJsonObject(result.content)) as unknown;

      if (!rawJson || typeof rawJson !== "object" || Array.isArray(rawJson)) {
        throw new Error("OpenAI summary response is not a JSON object");
      }

      const summary = MeetingSummarySchema.parse({
        ...(rawJson as Record<string, unknown>),
        date: source.meeting.startedAt?.toISOString() ?? source.meeting.createdAt.toISOString(),
        duration: formatDuration(source.meeting.startedAt, source.meeting.endedAt),
        transcript,
      });

      await db.meeting.update({
        where: { id: source.meeting.id },
        data: {
          summaryText: JSON.stringify(summary),
        },
      });

      await writeSummaryLog({
        meetingId: source.meeting.id,
        userId: params.userId,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - startedAt,
        status: "SUCCESS",
        metadata: {
          attempt: attempt + 1,
          segmentCount: source.segments.length,
          forced: params.force ?? false,
        },
      });
      await triggerWebhooks(source.meeting.organizationId, "meeting.summary.ready", {
        meetingId: source.meeting.id,
        title: source.meeting.title,
        generatedAt: new Date().toISOString(),
      });

      return summary;
    } catch (error) {
      lastError = error;
      logger.warn({ error, meetingId: params.meetingId, attempt: attempt + 1 }, "Summary generation attempt failed");
    }
  }

  const message = lastError instanceof Error ? lastError.message : "纪要生成失败";

  await writeSummaryLog({
    meetingId: source.meeting.id,
    userId: params.userId,
    inputTokens,
    outputTokens,
    latencyMs: Date.now() - startedAt,
    status: "ERROR",
    error: message,
    metadata: {
      attempts: SUMMARY_MAX_RETRIES + 1,
      segmentCount: source.segments.length,
      forced: params.force ?? false,
    },
  }).catch((error: unknown) => {
    logger.error({ error, meetingId: params.meetingId }, "Failed to write summary error log");
  });

  throw lastError instanceof Error ? lastError : new Error(message);
}
