import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { consumeInvitationToken, peekInvitationToken } from "@/lib/organizations";
import { invalidateOrgPermissionCache } from "@/utils/permissions";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export const POST = withApiHandler(async function POST(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const session = await requireAuth();

  const preview = await peekInvitationToken(token);

  if (!preview) {
    throw new AppError("INVITATION_EXPIRED", "邀请已失效或不存在", 404);
  }

  const user = await db.user.findFirst({
    where: {
      id: session.user.id,
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (!user) {
    throw new UnauthorizedError("请先登录后接受邀请");
  }

  if (user.email.toLowerCase() !== preview.email.toLowerCase()) {
    throw new ForbiddenError("当前账号邮箱与邀请邮箱不一致");
  }

  const invitation = await consumeInvitationToken(token);

  if (!invitation) {
    throw new AppError("INVITATION_EXPIRED", "邀请已失效或已被使用", 404);
  }

  const member = await db.$transaction(async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: invitation.orgId },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundError("组织不存在");
    }

    const existingMember = await tx.member.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: invitation.orgId,
        },
      },
      select: {
        id: true,
        role: true,
        organizationId: true,
      },
    });

    if (existingMember) {
      return existingMember;
    }

    return tx.member.create({
      data: {
        userId: user.id,
        organizationId: invitation.orgId,
        role: invitation.role,
      },
      select: {
        id: true,
        role: true,
        organizationId: true,
      },
    });
  });

  invalidateOrgPermissionCache(member.organizationId);

  return apiSuccess({
    accepted: true,
    member,
  });
});
