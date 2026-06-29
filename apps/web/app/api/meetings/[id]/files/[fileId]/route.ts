import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { deleteFromR2, getR2KeyFromUrl } from "@/lib/r2";
import { isAudioFile, requireFileInMeeting } from "@/lib/meeting-files";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; fileId: string }>;
};

export const DELETE = withApiHandler(async function DELETE(_request: Request, context: RouteContext) {
  const { id, fileId } = await context.params;
  const file = await requireFileInMeeting(id, fileId);

  await deleteFromR2(getR2KeyFromUrl(file.url));

  await db.$transaction(async (tx) => {
    await tx.meetingFile.delete({
      where: { id: file.id },
    });

    if (isAudioFile(file.type) && file.meeting) {
      await tx.meeting.update({
        where: { id: file.meeting.id },
        data: {
          audioUrl: null,
        },
      });
    }
  });

  return apiSuccess({ deleted: true });
});
