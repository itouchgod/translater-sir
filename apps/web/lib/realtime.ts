import type { WsMessage } from "@/types/websocket";
import { redis } from "@/lib/redis";
import { publishToMeeting } from "@/lib/ably";
import { RedisKeys } from "@/utils/redis-keys";
import { RedisTTL } from "@/utils/redis-ttl";

export async function storeMeetingRealtimeMessage(meetingId: string, message: WsMessage) {
  if (message.type === "subtitle" || message.type === "translation") {
    const key = RedisKeys.meetingSubtitle(meetingId);
    await redis
      .multi()
      .rpush(key, JSON.stringify(message))
      .ltrim(key, -100, -1)
      .expire(key, RedisTTL.MEETING_SUBTITLE)
      .exec();
  }

  if (message.type === "meeting:status") {
    await redis.setex(
      RedisKeys.meetingStatus(meetingId),
      RedisTTL.MEETING_STATUS,
      JSON.stringify(message),
    );
  }
}

export async function publishRealtimeMessage(meetingId: string, message: WsMessage) {
  await storeMeetingRealtimeMessage(meetingId, message);

  if (process.env.ABLY_API_KEY) {
    await publishToMeeting(meetingId, message.type, "data" in message ? message.data : null);
  }
}
