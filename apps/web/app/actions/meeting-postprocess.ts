"use server";

import type { MeetingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { publishRealtimeMessage } from "@/lib/realtime";
import { redis } from "@/lib/redis";
import type { WsMessage } from "@/types/websocket";
import { RedisKeys } from "@/utils/redis-keys";
import { RedisTTL } from "@/utils/redis-ttl";

type SubtitleMessage = Extract<WsMessage, { type: "subtitle" }>;
type TranslationMessage = Extract<WsMessage, { type: "translation" }>;

function isSubtitleMessage(message: WsMessage): message is SubtitleMessage {
  return message.type === "subtitle" && message.data.isFinal;
}

function isTranslationMessage(message: WsMessage): message is TranslationMessage {
  return message.type === "translation";
}

export async function endMeetingPostProcess(meetingId: string) {
  const meeting = await db.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!meeting) {
    return;
  }

  const entries = await redis.lrange(RedisKeys.meetingSubtitle(meeting.id), 0, -1);
  const subtitles: SubtitleMessage[] = [];
  const translations = new Map<string, TranslationMessage["data"]>();

  for (const entry of entries) {
    try {
      const message = JSON.parse(entry) as WsMessage;

      if (isSubtitleMessage(message)) {
        subtitles.push(message);
      }

      if (isTranslationMessage(message)) {
        translations.set(message.data.segmentId, message.data);
      }
    } catch (error) {
      logger.warn({ error, meetingId }, "Failed to parse cached realtime meeting message");
    }
  }

  if (subtitles.length > 0) {
    const existing = await db.meetingSegment.findMany({
      where: {
        meetingId: meeting.id,
        id: {
          in: subtitles.map((message) => message.data.segmentId),
        },
      },
      select: {
        id: true,
      },
    });
    const existingIds = new Set(existing.map((segment) => segment.id));
    const latest = await db.meetingSegment.findFirst({
      where: { meetingId: meeting.id },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    let nextSequence = (latest?.sequence ?? 0) + 1;

    for (const message of subtitles) {
      const translation = translations.get(message.data.segmentId);

      if (existingIds.has(message.data.segmentId)) {
        if (translation) {
          await db.meetingSegment.update({
            where: { id: message.data.segmentId },
            data: { translatedText: translation.translatedText },
          });
        }

        continue;
      }

      await db.meetingSegment.create({
        data: {
          id: message.data.segmentId.startsWith("asr:") ? undefined : message.data.segmentId,
          meetingId: meeting.id,
          sequence: nextSequence,
          originalText: message.data.text,
          translatedText: translation?.translatedText,
          language: message.data.language,
          startMs: 0,
          endMs: 0,
        },
      });
      nextSequence += 1;
    }
  }

  const completedStatus = "COMPLETED" satisfies MeetingStatus;
  await db.meeting.update({
    where: { id: meeting.id },
    data: {
      status: completedStatus,
    },
  });

  await publishRealtimeMessage(meeting.id, {
    type: "meeting:status",
    data: {
      meetingId: meeting.id,
      status: completedStatus,
      timestamp: Date.now(),
    },
  });
  await redis.setex(RedisKeys.meetingStatus(meeting.id), RedisTTL.MEETING_STATUS, completedStatus);
}
