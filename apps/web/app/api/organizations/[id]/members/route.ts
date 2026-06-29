import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireOrgMember } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { MembersQuerySchema } from "@/lib/validations/organization";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const GET = withApiHandler(async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  await requireOrgMember(id);

  const searchParams = new URL(request.url).searchParams;
  const parsed = MembersQuerySchema.safeParse({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "分页参数无效");
  }

  const members = await db.member.findMany({
    where: {
      organizationId: id,
      user: {
        deletedAt: null,
      },
    },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    take: parsed.data.limit + 1,
    skip: parsed.data.cursor ? 1 : 0,
    cursor: parsed.data.cursor ? { id: parsed.data.cursor } : undefined,
    select: {
      id: true,
      role: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  const hasMore = members.length > parsed.data.limit;
  const visibleMembers = hasMore ? members.slice(0, parsed.data.limit) : members;
  const nextCursor = hasMore ? visibleMembers.at(-1)?.id ?? null : null;

  return apiSuccess({
    members: visibleMembers,
    pageInfo: {
      nextCursor,
      hasMore,
    },
  });
});
