import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireAdminAccess } from "@/lib/admin";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { deleteFromR2, getR2Key, uploadToR2 } from "@/lib/r2";

export const runtime = "nodejs";

type HealthItem = {
  status: "ok" | "error";
  latencyMs: number;
};

async function checkDb(): Promise<HealthItem> {
  const startedAt = performance.now();

  try {
    await db.$queryRaw`SELECT 1`;
    return { status: "ok", latencyMs: Math.round(performance.now() - startedAt) };
  } catch (error) {
    logger.error({ error }, "Admin DB health check failed");
    return { status: "error", latencyMs: Math.round(performance.now() - startedAt) };
  }
}

async function checkRedis(): Promise<HealthItem> {
  const startedAt = performance.now();

  try {
    await redis.ping();
    return { status: "ok", latencyMs: Math.round(performance.now() - startedAt) };
  } catch (error) {
    logger.error({ error }, "Admin Redis health check failed");
    return { status: "error", latencyMs: Math.round(performance.now() - startedAt) };
  }
}

async function checkR2(): Promise<HealthItem> {
  const startedAt = performance.now();
  const key = getR2Key("organizationLog", "admin-health", `${crypto.randomUUID()}.txt`);
  let deleted = false;

  try {
    await uploadToR2({
      key,
      body: new Uint8Array([1]),
      contentType: "text/plain",
    });
    await deleteFromR2(key);
    deleted = true;
    return { status: "ok", latencyMs: Math.round(performance.now() - startedAt) };
  } catch (error) {
    logger.error({ error }, "Admin R2 health check failed");
    return { status: "error", latencyMs: Math.round(performance.now() - startedAt) };
  } finally {
    if (!deleted) {
      void deleteFromR2(key).catch(() => undefined);
    }
  }
}

export const GET = withApiHandler(async function GET() {
  await requireAdminAccess();
  const [dbHealth, redisHealth, r2Health] = await Promise.all([checkDb(), checkRedis(), checkR2()]);
  const errors = [dbHealth, redisHealth, r2Health].filter((item) => item.status === "error").length;
  const overall = errors === 0 ? "healthy" : errors === 3 ? "down" : "degraded";

  return NextResponse.json(
    {
      db: dbHealth,
      redis: redisHealth,
      r2: r2Health,
      overall,
    },
    {
      status: overall === "down" ? 503 : 200,
    },
  );
});
