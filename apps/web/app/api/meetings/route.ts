import { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requireOrgMember, requirePermission } from "@/lib/auth-helpers";
import { CacheTags } from "@/lib/cache-tags";
import { invalidateDashboardStats } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { QuotaExceededError, ValidationError } from "@/lib/errors";
import { checkMeetingQuota } from "@/lib/quota";
import { withRateLimit } from "@/lib/with-rate-limit";
import { CreateMeetingSchema, MeetingListQuerySchema } from "@/lib/validations/meeting";
import { auditLog } from "@/utils/audit";

export const runtime = "nodejs";

export const GET = withApiHandler(async function GET(request: Request) {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    return apiSuccess({
      items: [],
      nextCursor: null,
      hasMore: false,
    });
  }

  await requireOrgMember(organizationId);

  const parsed = MeetingListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsed.success) {
    throw new ValidationError("会议筛选参数无效");
  }

  const where: Prisma.MeetingWhereInput = {
    organizationId,
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(parsed.data.dateFrom || parsed.data.dateTo
      ? {
          createdAt: {
            ...(parsed.data.dateFrom ? { gte: parsed.data.dateFrom } : {}),
            ...(parsed.data.dateTo ? { lte: parsed.data.dateTo } : {}),
          },
        }
      : {}),
  };

  const meetings = await db.meeting.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(parsed.data.cursor
      ? {
          cursor: { id: parsed.data.cursor },
          skip: 1,
        }
      : {}),
    take: parsed.data.limit + 1,
    include: {
      _count: {
        select: {
          segments: true,
          files: true,
        },
      },
      files: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          type: true,
          name: true,
          sizeBytes: true,
          createdAt: true,
        },
      },
    },
  });
  const hasMore = meetings.length > parsed.data.limit;
  const items = hasMore ? meetings.slice(0, parsed.data.limit) : meetings;

  return apiSuccess({
    items,
    nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
    hasMore,
  });
});

export const POST = withRateLimit("api:meeting:create")(
  withApiHandler(async function POST(request: Request) {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    throw new ValidationError("请先加入或创建组织");
  }

  await requirePermission(organizationId, "meeting:create");

  const quota = await checkMeetingQuota(organizationId);
  if (!quota.allowed) {
    throw new QuotaExceededError(quota.reason);
  }

  const parsed = CreateMeetingSchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "会议信息无效");
  }

  const meeting = await db.meeting.create({
    data: {
      organizationId,
      createdById: session.user.id,
      title: parsed.data.title,
      sourceLanguage: parsed.data.sourceLanguage,
      targetLanguage: parsed.data.targetLanguage,
    },
  });

  await invalidateDashboardStats(organizationId);
  revalidateTag(CacheTags.meetings(organizationId));
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
  void auditLog({
    userId: session.user.id,
    action: "meeting.create",
    resource: "Meeting",
    resourceId: meeting.id,
    metadata: { organizationId, meetingId: meeting.id },
    request,
  });

  return apiSuccess(meeting, { status: 201 });
  }),
);
