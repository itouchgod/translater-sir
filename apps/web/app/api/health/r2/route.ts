import { NextResponse } from "next/server";
import { deleteFromR2, getR2Key, uploadToR2 } from "@/lib/r2";
import { logger } from "@/lib/logger";

export async function GET() {
  const startedAt = performance.now();
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

    return NextResponse.json({
      status: "ok",
      latencyMs: Math.round(performance.now() - startedAt),
    });
  } catch (error: unknown) {
    const latencyMs = Math.round(performance.now() - startedAt);
    logger.error({ error, latencyMs }, "R2 health check failed");

    return NextResponse.json(
      {
        status: "error",
        latencyMs,
        error: {
          code: "R2_UNAVAILABLE",
          message: "R2 不可用",
        },
      },
      { status: 503 },
    );
  } finally {
    if (!deleted) {
      void deleteFromR2(key).catch(() => undefined);
    }
  }
}
