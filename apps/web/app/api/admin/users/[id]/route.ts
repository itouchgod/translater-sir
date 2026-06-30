import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { getRequestAuditContext, requireAdminAccess } from "@/lib/admin";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { invalidateUserTokens } from "@/lib/jwt-blacklist";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const UpdateUserSchema = z.object({
  action: z.enum(["ban", "unban"]),
});

export const PATCH = withApiHandler(async function PATCH(request: Request, context: RouteContext) {
  const { session } = await requireAdminAccess();
  const { id } = await context.params;
  const parsed = UpdateUserSchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "用户操作无效");
  }

  if (id === session.user.id) {
    throw new ForbiddenError("不能封禁或解封自己");
  }

  const target = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      deletedAt: true,
    },
  });

  if (!target) {
    throw new NotFoundError("用户不存在");
  }

  const auditContext = getRequestAuditContext(request);
  const user = await db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: {
        deletedAt: parsed.data.action === "ban" ? target.deletedAt ?? new Date() : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        deletedAt: true,
        updatedAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: parsed.data.action === "ban" ? "admin.user.ban" : "admin.user.unban",
        resource: "User",
        resourceId: target.id,
        metadata: {
          targetEmail: target.email,
          previousDeletedAt: target.deletedAt?.toISOString() ?? null,
        },
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
      },
    });

    return updated;
  });

  if (parsed.data.action === "ban") {
    await invalidateUserTokens(target.id);
  }

  return apiSuccess(user);
});

export const DELETE = withApiHandler(async function DELETE(request: Request, context: RouteContext) {
  const { session } = await requireAdminAccess();
  const { id } = await context.params;

  if (id === session.user.id) {
    throw new ForbiddenError("不能删除自己");
  }

  const target = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      deletedAt: true,
    },
  });

  if (!target) {
    throw new NotFoundError("用户不存在");
  }

  if (target.role === "SUPER_ADMIN") {
    const activeSuperAdminCount = await db.user.count({
      where: {
        role: "SUPER_ADMIN",
        deletedAt: null,
      },
    });

    if (!target.deletedAt && activeSuperAdminCount <= 1) {
      throw new ForbiddenError("不能删除最后一个超级管理员");
    }
  }

  const auditContext = getRequestAuditContext(request);

  await db.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "admin.user.delete",
        resource: "User",
        resourceId: target.id,
        metadata: {
          targetEmail: target.email,
          targetRole: target.role,
          targetDeletedAt: target.deletedAt?.toISOString() ?? null,
        },
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
      },
    });

    await tx.user.delete({
      where: { id },
    });
  });

  await invalidateUserTokens(target.id);

  return apiSuccess({ deleted: true });
});
