import { AiType, Prisma } from "@prisma/client";
import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAdminAccess } from "@/lib/admin";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const AiLogsQuerySchema = z.object({
  provider: z.string().trim().max(50).optional(),
  type: z.enum(AiType).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = withApiHandler(async function GET(request: Request) {
  await requireAdminAccess();
  const parsed = AiLogsQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "AI 日志筛选参数无效");
  }

  const where: Prisma.AiLogWhereInput = {
    ...(parsed.data.provider ? { provider: parsed.data.provider } : {}),
    ...(parsed.data.type ? { type: parsed.data.type } : {}),
    ...(parsed.data.dateFrom || parsed.data.dateTo
      ? {
          createdAt: {
            ...(parsed.data.dateFrom ? { gte: parsed.data.dateFrom } : {}),
            ...(parsed.data.dateTo ? { lte: parsed.data.dateTo } : {}),
          },
        }
      : {}),
  };
  const logs = await db.aiLog.findMany({
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
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      meeting: {
        select: {
          id: true,
          title: true,
          organizationId: true,
        },
      },
    },
  });
  const hasMore = logs.length > parsed.data.limit;
  const items = hasMore ? logs.slice(0, parsed.data.limit) : logs;

  return apiSuccess({
    items,
    nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
    hasMore,
  });
});
