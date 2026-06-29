import { redis } from "@/lib/redis";
import { RedisKeys } from "@/utils/redis-keys";
import { RedisTTL } from "@/utils/redis-ttl";

function getRemainingSeconds(expiresAt: Date | number) {
  const expiresAtMs =
    expiresAt instanceof Date
      ? expiresAt.getTime()
      : expiresAt > 1_000_000_000_000
        ? expiresAt
        : expiresAt * 1000;

  return Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000));
}

export async function addToBlacklist(jti: string, expiresAt: Date | number): Promise<void> {
  const ttl = Math.min(getRemainingSeconds(expiresAt), RedisTTL.JWT_BLACKLIST);

  if (ttl <= 0) {
    return;
  }

  await redis.setex(RedisKeys.jwtBlacklist(jti), ttl, "1");
}

export async function isBlacklisted(jti: string): Promise<boolean> {
  return (await redis.get(RedisKeys.jwtBlacklist(jti))) !== null;
}
