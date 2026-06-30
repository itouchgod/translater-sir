import { randomUUID } from "node:crypto";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { RedisKeys } from "@/utils/redis-keys";

export const RATE_LIMITS = {
  "auth:login": { max: 5, window: 15 * 60 },
  "auth:register": { max: 3, window: 60 * 60 },
  "auth:forgot": { max: 3, window: 60 * 60 },
  "api:global": { max: 100, window: 60 },
  "api:meeting:create": { max: 10, window: 60 * 60 },
  "api:upload": { max: 20, window: 60 * 60 },
  "api:translate": { max: 60, window: 60 },
  "webhook:send": { max: 1000, window: 60 * 60 },
} as const;

export type RateLimitAction = keyof typeof RATE_LIMITS;

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
};

export function getRateLimitConfig(action: RateLimitAction) {
  return RATE_LIMITS[action];
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return 0;
}

export async function rateLimit(
  identifier: string,
  action: RateLimitAction,
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[action];
  const now = Date.now();
  const windowMs = config.window * 1000;
  const windowStart = now - windowMs;
  const key = RedisKeys.rateLimit(action, identifier);
  const member = `${now}:${randomUUID()}`;

  try {
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now, member);
    pipeline.zcard(key);
    pipeline.zrange(key, 0, 0, "WITHSCORES");
    pipeline.pexpire(key, windowMs);

    const results = await pipeline.exec();
    const count = toNumber(results?.[2]?.[1]);
    const oldest = results?.[3]?.[1];
    const oldestScore = Array.isArray(oldest) ? toNumber(oldest[1]) : now;
    const resetAtMs = oldestScore + windowMs;
    const retryAfter = Math.max(1, Math.ceil((resetAtMs - now) / 1000));
    const remaining = Math.max(config.max - count, 0);

    return {
      success: count <= config.max,
      remaining,
      resetAt: Math.ceil(resetAtMs / 1000),
      ...(count > config.max ? { retryAfter } : {}),
    };
  } catch (error) {
    logger.warn({ error, action, identifier }, "Rate limit check failed; allowing request");
    return {
      success: true,
      remaining: config.max,
      resetAt: Math.ceil((now + windowMs) / 1000),
    };
  }
}
