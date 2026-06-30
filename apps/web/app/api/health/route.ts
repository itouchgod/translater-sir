import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { deleteFromR2, getR2Key, uploadToR2 } from "@/lib/r2";

export const runtime = "nodejs";

type HealthStatus = "ok" | "error";

type ComponentHealth = {
  status: HealthStatus;
  latencyMs: number;
  error?: {
    code: string;
    message: string;
  };
};

async function measureHealth(
  name: "db" | "redis" | "r2",
  check: () => Promise<void>,
): Promise<ComponentHealth> {
  const startedAt = performance.now();

  try {
    await check();
    return {
      status: "ok",
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startedAt);
    logger.error({ error, component: name, latencyMs }, "Health check component failed");

    return {
      status: "error",
      latencyMs,
      error: {
        code: `${name.toUpperCase()}_UNAVAILABLE`,
        message: `${name} unavailable`,
      },
    };
  }
}

async function checkDb() {
  await db.$queryRaw`SELECT 1`;
}

async function checkRedis() {
  await redis.ping();
}

async function checkR2() {
  const key = getR2Key("organizationLog", "health", `${crypto.randomUUID()}.txt`);
  let deleted = false;

  try {
    await uploadToR2({
      key,
      body: new Uint8Array([1]),
      contentType: "text/plain",
    });
    await deleteFromR2(key);
    deleted = true;
  } finally {
    if (!deleted) {
      void deleteFromR2(key).catch(() => undefined);
    }
  }
}

export async function GET() {
  const [dbHealth, redisHealth, r2Health] = await Promise.all([
    measureHealth("db", checkDb),
    measureHealth("redis", checkRedis),
    measureHealth("r2", checkR2),
  ]);
  const components = {
    db: dbHealth,
    redis: redisHealth,
    r2: r2Health,
  };
  const errors = Object.values(components).filter((item) => item.status === "error").length;
  const overall = errors === 0 ? "healthy" : errors === 3 ? "down" : "degraded";

  return NextResponse.json(
    {
      overall,
      components,
    },
    {
      status: overall === "down" ? 503 : 200,
    },
  );
}
