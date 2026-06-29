import Redis from "ioredis";
import { logger } from "@/lib/logger";

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

function createRedisClient() {
  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    enableReadyCheck: true,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

  redis.on("error", (error) => {
    logger.error({ error }, "Redis connection error");
  });

  redis.on("connect", () => {
    logger.debug("Redis connected");
  });

  return redis;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
