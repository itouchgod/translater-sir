import { Prisma } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth-helpers";
import { invalidateUserMeCache } from "@/lib/cache-invalidation";
import { requireCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { UpdateProfileSchema } from "@/lib/validations/user";
import { auditLog } from "@/utils/audit";
import { withRedisCache } from "@/utils/redis-helpers";
import { RedisKeys } from "@/utils/redis-keys";
import { RedisTTL } from "@/utils/redis-ttl";

export const GET = withApiHandler(async function GET() {
  const session = await requireAuth();
  const user = await withRedisCache(
    RedisKeys.userMe(session.user.id),
    RedisTTL.USER_ME,
    requireCurrentUser,
  );

  if (!user) {
    throw new UnauthorizedError();
  }

  return apiSuccess(user);
});

export const PATCH = withApiHandler(async function PATCH(request: Request) {
  const session = await requireAuth();

  try {
    const body = await request.json();
    const parsed = UpdateProfileSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "资料信息无效");
    }

    const user = await db.user.update({
      where: {
        id: session.user.id,
        deletedAt: null,
      },
      data: {
        name: parsed.data.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });

    await invalidateUserMeCache(session.user.id);

    return apiSuccess(user);
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("用户不存在");
    }

    if (error instanceof ValidationError) {
      throw error;
    }

    logger.error({ error, userId: session.user.id }, "Failed to update profile");
    return apiError("INTERNAL_ERROR", "更新资料失败，请稍后重试", 500);
  }
});

export const DELETE = withApiHandler(async function DELETE(request: Request) {
  const session = await requireAuth();

  try {
    const user = await db.user.update({
      where: {
        id: session.user.id,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
      select: {
        id: true,
        deletedAt: true,
      },
    });
    await invalidateUserMeCache(session.user.id);
    void auditLog({
      userId: session.user.id,
      action: "user.account.delete",
      resource: "User",
      resourceId: session.user.id,
      request,
    });

    return apiSuccess(user);
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("用户不存在");
    }

    logger.error({ error, userId: session.user.id }, "Failed to soft delete user");
    return apiError("INTERNAL_ERROR", "注销账号失败，请稍后重试", 500);
  }
});
