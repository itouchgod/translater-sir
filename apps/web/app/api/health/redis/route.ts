import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

export async function GET() {
  const startedAt = performance.now();

  try {
    await redis.ping();
    const latencyMs = Math.round(performance.now() - startedAt);

    return NextResponse.json({
      status: "ok",
      latencyMs,
    });
  } catch (error: unknown) {
    const latencyMs = Math.round(performance.now() - startedAt);
    logger.error({ error, latencyMs }, "Redis health check failed");

    return NextResponse.json(
      {
        status: "error",
        latencyMs,
        error: {
          code: "REDIS_UNAVAILABLE",
          message: "Redis 不可用",
        },
      },
      { status: 503 },
    );
  }
}
