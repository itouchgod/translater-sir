import { randomUUID } from "node:crypto";
import { redis } from "@/lib/redis";
import { RedisKeys } from "@/utils/redis-keys";
import { RedisTTL } from "@/utils/redis-ttl";

const LOGIN_WINDOW_SECONDS = RedisTTL.RATE_LIMIT_LOGIN;
const LOGIN_LIMIT = 5;

export function getLoginRateLimitKey(email: string) {
  return RedisKeys.rateLimit("auth:login", email.toLowerCase());
}

export async function isLoginRateLimited(email: string) {
  const key = getLoginRateLimitKey(email);
  const now = Date.now();
  const windowStart = now - LOGIN_WINDOW_SECONDS * 1000;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zcard(key);
  pipeline.pexpire(key, LOGIN_WINDOW_SECONDS * 1000);

  const results = await pipeline.exec();
  const countResult = results?.[1]?.[1];
  const count = typeof countResult === "number" ? countResult : 0;

  return count >= LOGIN_LIMIT;
}

export async function recordFailedLogin(email: string) {
  const key = getLoginRateLimitKey(email);
  const now = Date.now();

  const pipeline = redis.pipeline();
  pipeline.zadd(key, now, `${now}:${randomUUID()}`);
  pipeline.pexpire(key, LOGIN_WINDOW_SECONDS * 1000);
  await pipeline.exec();
}

export async function clearFailedLogins(email: string) {
  await redis.del(getLoginRateLimitKey(email));
}
