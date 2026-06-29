import { redis } from "@/lib/redis";

export async function withRedisCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await redis.get(key);

  if (cached !== null) {
    return JSON.parse(cached) as T;
  }

  const value = await fetcher();
  await redis.setex(key, ttl, JSON.stringify(value));

  return value;
}
