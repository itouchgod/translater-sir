import type { AiType } from "@prisma/client";
import { createAsrStream, type AsrStream, type TranscriptResult } from "@/lib/asr";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { publishRealtimeMessage } from "@/lib/realtime";
import { translateText } from "@/lib/translation";
import type { WsMessage } from "@/types/websocket";

type MeetingAsrContext = {
  meetingId: string;
  organizationId: string;
  language: string;
  targetLanguage: string;
  userId: string;
};

type MeetingAsrSession = {
  stream: AsrStream;
  context: MeetingAsrContext;
  lastChunkAt: number;
};

const SESSION_IDLE_MS = 10 * 60 * 1000;
const ASR_LOG_TYPE = "ASR" satisfies AiType;

const sessions = new Map<string, MeetingAsrSession>();

function getInterimSegmentId(result: TranscriptResult) {
  const requestId = result.requestId ?? "local";
  return `asr:${requestId}:${result.startMs}:${result.endMs}`;
}

function cleanupIdleSessions(now = Date.now()) {
  for (const [meetingId, session] of sessions) {
    if (now - session.lastChunkAt <= SESSION_IDLE_MS) {
      continue;
    }

    session.stream.close();
    sessions.delete(meetingId);
  }
}

async function writeAiLog(
  context: MeetingAsrContext,
  result: TranscriptResult,
  status: "SUCCESS" | "ERROR",
  latencyMs: number,
  error?: string,
) {
  await db.aiLog.create({
    data: {
      meetingId: context.meetingId,
      userId: context.userId,
      provider: result.provider,
      model: result.model,
      type: ASR_LOG_TYPE,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs,
      status,
      error,
    },
  });
}

async function createFinalSegment(context: MeetingAsrContext, result: TranscriptResult) {
  return db.$transaction(async (tx) => {
    const latest = await tx.meetingSegment.findFirst({
      where: {
        meetingId: context.meetingId,
      },
      orderBy: {
        sequence: "desc",
      },
      select: {
        sequence: true,
      },
    });

    return tx.meetingSegment.create({
      data: {
        meetingId: context.meetingId,
        sequence: (latest?.sequence ?? 0) + 1,
        originalText: result.text,
        language: result.language,
        startMs: result.startMs,
        endMs: result.endMs,
        confidence: result.confidence,
      },
      select: {
        id: true,
      },
    });
  });
}

async function translateFinalSegment(
  session: MeetingAsrSession,
  segmentId: string,
  result: TranscriptResult,
) {
  try {
    const translation = await translateText({
      text: result.text,
      sourceLanguage: session.context.language,
      targetLanguage: session.context.targetLanguage,
      meetingId: session.context.meetingId,
      userId: session.context.userId,
    });

    await db.meetingSegment.update({
      where: {
        id: segmentId,
      },
      data: {
        translatedText: translation.translatedText,
      },
    });

    await publishRealtimeMessage(session.context.meetingId, {
      type: "translation",
      data: {
        segmentId,
        originalText: result.text,
        translatedText: translation.translatedText,
        sourceLanguage: session.context.language,
        targetLanguage: session.context.targetLanguage,
      },
    });
  } catch (error) {
    logger.error(
      { error, meetingId: session.context.meetingId, segmentId },
      "ASR final segment translation failed",
    );
  }
}

async function handleTranscript(
  session: MeetingAsrSession,
  result: TranscriptResult,
): Promise<void> {
  const latencyMs = Math.max(0, result.receivedAt - session.lastChunkAt);
  let segmentId = getInterimSegmentId(result);

  try {
    if (result.isFinal) {
      const segment = await createFinalSegment(session.context, result);
      segmentId = segment.id;
    }

    const message: WsMessage = {
      type: "subtitle",
      data: {
        segmentId,
        text: result.text,
        isFinal: result.isFinal,
        language: result.language,
        timestamp: result.receivedAt,
      },
    };

    await publishRealtimeMessage(session.context.meetingId, message);
    await writeAiLog(session.context, result, "SUCCESS", latencyMs);

    if (result.isFinal) {
      void translateFinalSegment(session, segmentId, result);
    }
  } catch (error) {
    logger.error({ error, meetingId: session.context.meetingId }, "ASR transcript handling failed");
    await writeAiLog(
      session.context,
      result,
      "ERROR",
      latencyMs,
      error instanceof Error ? error.message : "Unknown ASR handling error",
    ).catch((logError: unknown) => {
      logger.error({ error: logError }, "Failed to write ASR error log");
    });
  }
}

async function writeStreamErrorLog(context: MeetingAsrContext, error: Error) {
  await db.aiLog
    .create({
      data: {
        meetingId: context.meetingId,
        userId: context.userId,
        provider: "deepgram",
        model: "nova-3",
        type: ASR_LOG_TYPE,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
        status: "ERROR",
        error: error.message,
      },
    })
    .catch((logError: unknown) => {
      logger.error({ error: logError }, "Failed to write Deepgram stream error log");
    });
}

export function getMeetingAsrSession(context: MeetingAsrContext): MeetingAsrSession {
  cleanupIdleSessions();

  const existing = sessions.get(context.meetingId);

  if (existing) {
    existing.context = context;
    return existing;
  }

  const session = {
    context,
    lastChunkAt: Date.now(),
    stream: null as unknown as AsrStream,
  } satisfies MeetingAsrSession;

  session.stream = createAsrStream({
    provider: "deepgram",
    language: context.language,
    model: "nova-3",
    sampleRate: 16000,
    maxReconnects: 3,
    onTranscript: (result) => handleTranscript(session, result),
    onError: (error) => writeStreamErrorLog(session.context, error),
  });

  sessions.set(context.meetingId, session);
  return session;
}

export async function sendMeetingAudioChunk(
  context: MeetingAsrContext,
  chunk: Buffer,
): Promise<void> {
  const session = getMeetingAsrSession(context);
  session.lastChunkAt = Date.now();
  await session.stream.sendAudio(chunk);
}

export function closeMeetingAsrSession(meetingId: string) {
  const session = sessions.get(meetingId);
  session?.stream.close();
  sessions.delete(meetingId);
}
