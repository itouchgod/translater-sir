import { redis } from "@/lib/redis";
import { RedisKeys } from "@/utils/redis-keys";
import { rateLimit } from "@/utils/rate-limit";

export function getLoginRateLimitKey(email: string) {
  return RedisKeys.rateLimit("auth:login", email.toLowerCase());
}

export async function isLoginRateLimited(email: string) {
  const result = await rateLimit(email.toLowerCase(), "auth:login");
  return !result.success;
}

export async function recordFailedLogin(email: string) {
  await rateLimit(email.toLowerCase(), "auth:login");
}

export async function clearFailedLogins(email: string) {
  await redis.del(getLoginRateLimitKey(email));
}
