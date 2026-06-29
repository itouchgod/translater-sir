import { redis } from "@/lib/redis";
import { RedisKeys } from "@/utils/redis-keys";
import { RedisTTL } from "@/utils/redis-ttl";

export type SessionData = Record<string, unknown>;

export async function getSession(sessionId: string): Promise<SessionData | null> {
  const raw = await redis.get(RedisKeys.session(sessionId));

  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as SessionData;
}

export async function setSession(
  sessionId: string,
  data: SessionData,
  ttl = RedisTTL.SESSION,
): Promise<void> {
  await redis.setex(RedisKeys.session(sessionId), ttl, JSON.stringify(data));
}

export async function deleteSession(sessionId: string): Promise<void> {
  await redis.del(RedisKeys.session(sessionId));
}
