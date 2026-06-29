import { FileType, Prisma } from "@prisma/client";
import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  assertMeetingAudioKey,
  getMeetingFileName,
  requireMeetingFileAccess,
} from "@/lib/meeting-files";
import { getR2PublicUrl, headR2Object } from "@/lib/r2";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ConfirmAudioSchema = z.object({
  key: z.string().trim().min(1).max(512),
  fileName: z.string().trim().min(1).max(180).optional(),
});

export const POST = withApiHandler(async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const meeting = await requireMeetingFileAccess(id);
  const parsed = ConfirmAudioSchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "录音确认信息无效");
  }

  assertMeetingAudioKey({
    key: parsed.data.key,
    orgId: meeting.organizationId,
    meetingId: meeting.id,
  });

  const object = await headR2Object(parsed.data.key);
  const url = getR2PublicUrl(parsed.data.key);

  try {
    const result = await db.$transaction(async (tx) => {
      const file = await tx.meetingFile.create({
        data: {
          meetingId: meeting.id,
          type: FileType.AUDIO,
          name: parsed.data.fileName ?? getMeetingFileName(parsed.data.key),
          url,
          sizeBytes: object.ContentLength ?? 0,
        },
      });

      const updatedMeeting = await tx.meeting.update({
        where: { id: meeting.id },
        data: { audioUrl: url },
        select: {
          id: true,
          audioUrl: true,
        },
      });

      return { file, meeting: updatedMeeting };
    });

    return apiSuccess({ key: parsed.data.key, url, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new NotFoundError("会议不存在");
    }

    throw error;
  }
});
