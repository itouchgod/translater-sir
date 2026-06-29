import { FileType, Prisma } from "@prisma/client";
import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requireOrgMember } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { getR2Key, getR2PublicUrl, headR2Object } from "@/lib/r2";

const ConfirmUploadSchema = z.object({
  key: z.string().trim().min(1).max(512),
  purpose: z.enum(["avatar", "audio", "attachment"]),
  meetingId: z.string().trim().min(1).optional(),
  fileName: z.string().trim().min(1).max(180).optional(),
});

function getFileName(key: string, fileName: string | undefined) {
  return fileName?.trim() || key.split("/").at(-1) || "file";
}

async function requireMeetingAccess(meetingId: string, organizationId: string) {
  const meeting = await db.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!meeting) {
    throw new NotFoundError("会议不存在");
  }

  if (meeting.organizationId !== organizationId) {
    throw new ForbiddenError("无权访问该会议");
  }

  await requireOrgMember(meeting.organizationId);

  return meeting;
}

export const POST = withApiHandler(async function POST(request: Request) {
  const session = await requireAuth();
  const body = await request.json();
  const parsed = ConfirmUploadSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "上传确认信息无效");
  }

  const organizationId = session.user.organizationId;

  if (!organizationId) {
    throw new ForbiddenError("当前账号没有可用组织");
  }

  const object = await headR2Object(parsed.data.key);
  const url = getR2PublicUrl(parsed.data.key);

  if (parsed.data.purpose === "avatar") {
    const avatarPrefix = getR2Key("avatar", organizationId);

    if (!parsed.data.key.startsWith(`${avatarPrefix}/`)) {
      throw new ForbiddenError("头像文件 Key 无效");
    }

    const user = await db.user.update({
      where: {
        id: session.user.id,
        deletedAt: null,
      },
      data: {
        avatarUrl: url,
      },
      select: {
        id: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });

    return apiSuccess({ url: user.avatarUrl, key: parsed.data.key, user });
  }

  if (!parsed.data.meetingId) {
    throw new ValidationError("会议 ID 不能为空");
  }

  await requireMeetingAccess(parsed.data.meetingId, organizationId);

  const expectedPrefix =
    parsed.data.purpose === "audio"
      ? getR2Key("meetingAudio", organizationId, parsed.data.meetingId)
      : getR2Key("meetingAttachment", organizationId, parsed.data.meetingId);

  if (!parsed.data.key.startsWith(`${expectedPrefix}/`)) {
    throw new ForbiddenError("文件 Key 无效");
  }

  const type = parsed.data.purpose === "audio" ? FileType.AUDIO : FileType.ATTACHMENT;

  try {
    const file = await db.meetingFile.create({
      data: {
        meetingId: parsed.data.meetingId,
        type,
        name: getFileName(parsed.data.key, parsed.data.fileName),
        url,
        sizeBytes: object.ContentLength ?? 0,
      },
      select: {
        id: true,
        type: true,
        name: true,
        url: true,
        sizeBytes: true,
        createdAt: true,
      },
    });

    if (type === FileType.AUDIO) {
      await db.meeting.update({
        where: { id: parsed.data.meetingId },
        data: { audioUrl: url },
      });
    }

    return apiSuccess({ url, key: parsed.data.key, file });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new NotFoundError("会议不存在");
    }

    throw error;
  }
});
