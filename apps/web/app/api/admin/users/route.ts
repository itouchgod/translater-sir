import { Prisma } from "@prisma/client";
import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAdminAccess } from "@/lib/admin";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

const UserListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = withApiHandler(async function GET(request: Request) {
  await requireAdminAccess();
  const parsed = UserListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "用户筛选参数无效");
  }

  const where: Prisma.UserWhereInput = parsed.data.q
    ? {
        OR: [
          { email: { contains: parsed.data.q, mode: "insensitive" } },
          { name: { contains: parsed.data.q, mode: "insensitive" } },
        ],
      }
    : {};
  const users = await db.user.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(parsed.data.cursor
      ? {
          cursor: { id: parsed.data.cursor },
          skip: 1,
        }
      : {}),
    take: parsed.data.limit + 1,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          memberships: true,
          meetings: true,
          aiLogs: true,
        },
      },
    },
  });
  const hasMore = users.length > parsed.data.limit;
  const items = hasMore ? users.slice(0, parsed.data.limit) : users;

  return apiSuccess({
    items,
    nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
    hasMore,
  });
});
