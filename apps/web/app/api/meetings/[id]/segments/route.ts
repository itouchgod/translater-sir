import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireOrgMember } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const QuerySchema = z.object({
  cursor: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = withApiHandler(async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));

  if (!parsed.success) {
    throw new ValidationError("字幕分页参数无效");
  }

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

  const segments = await db.meetingSegment.findMany({
    where: {
      meetingId: meeting.id,
      ...(parsed.data.cursor
        ? {
            sequence: {
              gt: parsed.data.cursor,
            },
          }
        : {}),
    },
    orderBy: {
      sequence: "asc",
    },
    take: parsed.data.limit + 1,
    select: {
      id: true,
      originalText: true,
      translatedText: true,
      language: true,
      sequence: true,
      createdAt: true,
    },
  });
  const hasMore = segments.length > parsed.data.limit;
  const items = hasMore ? segments.slice(0, parsed.data.limit) : segments;
  const nextCursor = hasMore ? items.at(-1)?.sequence ?? null : null;

  return apiSuccess({
    items: items.map((segment) => ({
      id: segment.id,
      text: segment.originalText,
      translation: segment.translatedText,
      isFinal: true,
      language: segment.language,
      timestamp: segment.createdAt.getTime(),
      sequence: segment.sequence,
    })),
    nextCursor,
    hasMore,
  });
});
