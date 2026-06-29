import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requireOrgMember } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { redis } from "@/lib/redis";
import { getR2KeyFromUrl, getSignedDownloadUrl } from "@/lib/r2";
import { RedisKeys } from "@/utils/redis-keys";
import { RedisTTL } from "@/utils/redis-ttl";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

export const GET = withApiHandler(async function GET(_request: Request, context: RouteContext) {
  const session = await requireAuth();
  const { fileId } = await context.params;
  const file = await db.meetingFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      url: true,
      name: true,
      meeting: {
        select: {
          id: true,
          organizationId: true,
        },
      },
    },
  });

  if (!file) {
    throw new NotFoundError("文件不存在");
  }

  await requireOrgMember(file.meeting.organizationId);

  const key = getR2KeyFromUrl(file.url);
  const downloadUrl = await getSignedDownloadUrl(key, RedisTTL.DOWNLOAD_TOKEN);
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + RedisTTL.DOWNLOAD_TOKEN * 1000);

  await redis.setex(
    RedisKeys.downloadToken(token),
    RedisTTL.DOWNLOAD_TOKEN,
    JSON.stringify({
      fileId: file.id,
      meetingId: file.meeting.id,
      userId: session.user.id,
      key,
      expiresAt: expiresAt.toISOString(),
    }),
  );

  await db.downloadLog.create({
    data: {
      userId: session.user.id,
      fileUrl: file.url,
      token,
      expiresAt,
      downloadedAt: new Date(),
    },
  });

  return NextResponse.redirect(downloadUrl);
});
