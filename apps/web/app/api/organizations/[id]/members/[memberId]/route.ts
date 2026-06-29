import { MemberRole, Prisma } from "@prisma/client";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requirePermission } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { countOrganizationOwners } from "@/lib/organizations";
import { UpdateMemberRoleSchema } from "@/lib/validations/organization";
import { invalidateOrgPermissionCache } from "@/utils/permissions";

type RouteContext = {
  params: Promise<{ id: string; memberId: string }>;
};

async function getEditableMember(organizationId: string, memberId: string) {
  return db.member.findFirst({
    where: {
      id: memberId,
      organizationId,
      user: {
        deletedAt: null,
      },
    },
    include: {
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
}

export const PATCH = withApiHandler(async function PATCH(request: Request, context: RouteContext) {
  const { id, memberId } = await context.params;
  const access = await requirePermission(id, "member:manage");

  if (access.member.id === memberId) {
    throw new ForbiddenError("不能修改自己的角色");
  }

  const body = await request.json();
  const parsed = UpdateMemberRoleSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "成员角色无效");
  }

  const targetMember = await getEditableMember(id, memberId);

  if (!targetMember) {
    throw new NotFoundError("成员不存在");
  }

  if (targetMember.role === MemberRole.OWNER) {
    throw new ForbiddenError("不能降级 OWNER，必须先转让 OWNER");
  }

  try {
    const member = await db.member.update({
      where: { id: memberId },
      data: { role: parsed.data.role },
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

    invalidateOrgPermissionCache(id);

    return apiSuccess(member);
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("成员不存在");
    }

    throw error;
  }
});

export const DELETE = withApiHandler(async function DELETE(_request: Request, context: RouteContext) {
  const { id, memberId } = await context.params;
  const access = await requirePermission(id, "member:manage");

  if (access.member.id === memberId) {
    throw new ForbiddenError("不能从组织中移除自己");
  }

  const targetMember = await getEditableMember(id, memberId);

  if (!targetMember) {
    throw new NotFoundError("成员不存在");
  }

  if (targetMember.role === MemberRole.OWNER) {
    const ownerCount = await countOrganizationOwners(id);
    throw new ForbiddenError(
      ownerCount <= 1 ? "唯一 OWNER 不能被移除，请先转让 OWNER" : "OWNER 不能被直接移除",
    );
  }

  await db.member.delete({
    where: { id: memberId },
  });

  invalidateOrgPermissionCache(id);

  return apiSuccess({ removed: true });
});
