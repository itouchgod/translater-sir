import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requireOrgMember } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { createMeetingSubscribeTokenRequest } from "@/lib/ably";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const POST = withApiHandler(async function POST(_request: Request, context: RouteContext) {
  const session = await requireAuth();
  const { id } = await context.params;
  const meeting = await db.meeting.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!meeting) {
    throw new NotFoundError("会议不存在");
  }

  await requireOrgMember(meeting.organizationId);

  const tokenRequest = await createMeetingSubscribeTokenRequest({
    meetingId: meeting.id,
    clientId: session.user.id,
  });

  return apiSuccess(tokenRequest);
});
