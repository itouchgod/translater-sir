import { Prisma } from "@prisma/client";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireOrgMember, requirePermission } from "@/lib/auth-helpers";
import { invalidateOrganizationCache } from "@/lib/cache-invalidation";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { getR2Key, getR2PublicUrl } from "@/lib/r2";
import { UpdateOrganizationSchema } from "@/lib/validations/organization";
import { withRedisCache } from "@/utils/redis-helpers";
import { RedisKeys } from "@/utils/redis-keys";
import { RedisTTL } from "@/utils/redis-ttl";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const GET = withApiHandler(async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const access = await requireOrgMember(id);
  const organization = await withRedisCache(RedisKeys.organization(id), RedisTTL.ORGANIZATION, async () => ({
    id: access.organization.id,
    name: access.organization.name,
    slug: access.organization.slug,
    logoUrl: access.organization.logoUrl,
    plan: access.organization.plan,
  }));

  return apiSuccess({
    ...organization,
    currentMember: {
      id: access.member.id,
      role: access.member.role,
      joinedAt: access.member.joinedAt,
    },
  });
});

export const PATCH = withApiHandler(async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  await requirePermission(id, "member:manage");

  const body = await request.json();
  const parsed = UpdateOrganizationSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "组织信息无效");
  }

  const logoPrefix = getR2Key("organizationLogo", id);

  if (parsed.data.logoKey && !parsed.data.logoKey.startsWith(`${logoPrefix}/`)) {
    throw new ForbiddenError("Logo 文件 Key 无效");
  }

  try {
    const organization = await db.organization.update({
      where: { id },
      data: {
        name: parsed.data.name,
        logoUrl: parsed.data.logoKey ? getR2PublicUrl(parsed.data.logoKey) : undefined,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        plan: true,
        updatedAt: true,
      },
    });

    await invalidateOrganizationCache(id);

    return apiSuccess(organization);
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("组织不存在");
    }

    throw error;
  }
});
