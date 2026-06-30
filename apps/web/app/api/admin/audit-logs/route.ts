import { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAdminAccess } from "@/lib/admin";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const AuditLogsQuerySchema = z.object({
  userId: z.string().trim().min(1).optional(),
  action: z.string().trim().max(120).optional(),
  resource: z.string().trim().max(120).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = withApiHandler(async function GET(request: Request) {
  const { session, user } = await requireAdminAccess();
  const parsed = AuditLogsQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "审计日志筛选参数无效");
  }

  const where: Prisma.AuditLogWhereInput = {
    ...(parsed.data.userId ? { userId: parsed.data.userId } : {}),
    ...(parsed.data.action ? { action: parsed.data.action } : {}),
    ...(parsed.data.resource ? { resource: parsed.data.resource } : {}),
    ...(parsed.data.dateFrom || parsed.data.dateTo
      ? {
          createdAt: {
            ...(parsed.data.dateFrom ? { gte: parsed.data.dateFrom } : {}),
            ...(parsed.data.dateTo ? { lte: parsed.data.dateTo } : {}),
          },
        }
      : {}),
  };

  if (user.role !== UserRole.SUPER_ADMIN) {
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return apiSuccess({ items: [], nextCursor: null, hasMore: false });
    }

    where.metadata = {
      path: ["organizationId"],
      equals: organizationId,
    };
  }

  const logs = await db.auditLog.findMany({
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
