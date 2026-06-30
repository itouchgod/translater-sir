import { apiError, apiSuccess } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { UpdatePasswordSchema } from "@/lib/validations/user";
import { auditLog } from "@/utils/audit";
import { hashPassword, verifyPassword } from "@/utils/password";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return apiError("UNAUTHORIZED", "请先登录", 401);
  }

  try {
    const body = await request.json();
    const parsed = UpdatePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "密码信息无效",
        400,
      );
    }

    const user = await db.user.findFirst({
      where: {
        id: session.user.id,
        deletedAt: null,
      },
      select: {
        passwordHash: true,
      },
    });

    if (!user?.passwordHash) {
      return apiError("PASSWORD_NOT_SET", "当前账号未设置密码，请使用第三方登录", 400);
    }

    const passwordMatches = await verifyPassword(
      parsed.data.currentPassword,
      user.passwordHash,
    );

    if (!passwordMatches) {
      return apiError("INVALID_PASSWORD", "当前密码不正确", 400);
    }

    await db.user.update({
      where: { id: session.user.id },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
      },
    });
    void auditLog({
      userId: session.user.id,
      action: "user.password.change",
      resource: "User",
      resourceId: session.user.id,
      request,
    });

    return apiSuccess({ updated: true });
  } catch (error: unknown) {
    logger.error({ error, userId: session.user.id }, "Failed to update password");
    return apiError("INTERNAL_ERROR", "修改密码失败，请稍后重试", 500);
  }
}
