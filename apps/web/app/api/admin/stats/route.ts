import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAdminAccess } from "@/lib/admin";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export const GET = withApiHandler(async function GET() {
  await requireAdminAccess();
  const [
    totalUsers,
    activeUsers,
    bannedUsers,
    totalOrganizations,
    totalMeetings,
    liveMeetings,
    totalAiCalls,
    tokenAggregate,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { deletedAt: null } }),
    db.user.count({ where: { deletedAt: { not: null } } }),
    db.organization.count(),
    db.meeting.count(),
    db.meeting.count({ where: { status: "LIVE" } }),
    db.aiLog.count(),
    db.aiLog.aggregate({
      _sum: {
        inputTokens: true,
        outputTokens: true,
      },
    }),
  ]);

  return apiSuccess({
    totalUsers,
    activeUsers,
    bannedUsers,
    totalOrganizations,
    totalMeetings,
    liveMeetings,
    totalAiCalls,
    totalTokens:
      (tokenAggregate._sum.inputTokens ?? 0) + (tokenAggregate._sum.outputTokens ?? 0),
  });
});
