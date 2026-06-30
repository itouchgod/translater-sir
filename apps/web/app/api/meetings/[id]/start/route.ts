import { MeetingStatus } from "@prisma/client";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requirePermission } from "@/lib/auth-helpers";
import { invalidateDashboardStats } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { publishRealtimeMessage } from "@/lib/realtime";
import { redis } from "@/lib/redis";
import { triggerWebhooks } from "@/lib/webhook-events";
import { auditLog } from "@/utils/audit";
import { RedisKeys } from "@/utils/redis-keys";
import { RedisTTL } from "@/utils/redis-ttl";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const POST = withApiHandler(async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const meeting = await db.meeting.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      status: true,
      startedAt: true,
    },
  });

  if (!meeting) {
    throw new NotFoundError("会议不存在");
  }

  const access = await requirePermission(meeting.organizationId, "meeting:create");

  const startedAt = meeting.startedAt ?? new Date();
  const updated = await db.meeting.update({
    where: { id: meeting.id },
    data: {
      status: MeetingStatus.LIVE,
      startedAt,
    },
  });
  const message = {
    type: "meeting:status" as const,
    data: {
      meetingId: meeting.id,
      status: MeetingStatus.LIVE,
      timestamp: Date.now(),
    },
  };

  await publishRealtimeMessage(meeting.id, message);
  await redis.setex(RedisKeys.meetingStatus(meeting.id), RedisTTL.MEETING_STATUS, "LIVE");
  await invalidateDashboardStats(meeting.organizationId);
  await triggerWebhooks(meeting.organizationId, "meeting.started", {
    meetingId: meeting.id,
    status: MeetingStatus.LIVE,
    startedAt: updated.startedAt?.toISOString() ?? null,
  });
  void auditLog({
    userId: access.session.user.id,
    action: "meeting.start",
    resource: "Meeting",
    resourceId: meeting.id,
    metadata: { organizationId: meeting.organizationId, meetingId: meeting.id },
    request,
  });

  return apiSuccess(updated);
});
