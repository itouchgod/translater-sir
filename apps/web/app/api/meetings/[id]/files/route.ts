import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { requireMeetingFileAccess } from "@/lib/meeting-files";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const GET = withApiHandler(async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  await requireMeetingFileAccess(id);

  const files = await db.meetingFile.findMany({
    where: { meetingId: id },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(files);
});
