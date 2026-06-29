import { Prisma } from "@prisma/client";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requireOrgMember, requirePermission } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { deleteFromR2, getR2KeyFromUrl } from "@/lib/r2";
import { UpdateMeetingSchema } from "@/lib/validations/meeting";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getMeetingForAccess(id: string) {
  const meeting = await db.meeting.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      createdById: true,
    },
  });

  if (!meeting) {
    throw new NotFoundError("会议不存在");
  }

  return meeting;
}

export const GET = withApiHandler(async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const meeting = await db.meeting.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
      files: {
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          segments: true,
          files: true,
        },
      },
    },
  });

  if (!meeting) {
    throw new NotFoundError("会议不存在");
  }

  await requireOrgMember(meeting.organizationId);

  return apiSuccess(meeting);
});

export const PATCH = withApiHandler(async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const meeting = await getMeetingForAccess(id);
  await requirePermission(meeting.organizationId, "meeting:create");

  const parsed = UpdateMeetingSchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "会议信息无效");
  }

  try {
    const updated = await db.meeting.update({
      where: { id: meeting.id },
      data: parsed.data,
    });

    return apiSuccess(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("会议不存在");
    }

    throw error;
  }
});

export const DELETE = withApiHandler(async function DELETE(request: Request, context: RouteContext) {
  const session = await requireAuth();
  const { id } = await context.params;
  const meeting = await getMeetingForAccess(id);
  await requirePermission(meeting.organizationId, "meeting:delete");

  const files = await db.meetingFile.findMany({
    where: { meetingId: meeting.id },
    select: {
      id: true,
      url: true,
    },
  });

  await Promise.all(files.map((file) => deleteFromR2(getR2KeyFromUrl(file.url))));

  await db.$transaction([
    db.meetingFile.deleteMany({
      where: { meetingId: meeting.id },
    }),
    db.meeting.delete({
      where: { id: meeting.id },
    }),
    db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "meeting.delete",
        resource: "Meeting",
        resourceId: meeting.id,
        metadata: {
          organizationId: meeting.organizationId,
          fileIds: files.map((file) => file.id),
        },
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: request.headers.get("user-agent"),
      },
    }),
  ]);

  return apiSuccess({ deleted: true });
});
