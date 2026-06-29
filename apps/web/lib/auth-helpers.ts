import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import type { Permission } from "@/utils/permissions";
import { canInOrg } from "@/utils/permissions";

async function getOrgMemberForSession(session: Session, orgId: string) {
  const member = await db.member.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: orgId,
      },
    },
    include: {
      organization: true,
      user: {
        select: {
          deletedAt: true,
        },
      },
    },
  });

  if (!member || member.user.deletedAt) {
    throw new ForbiddenError("无权访问该组织");
  }

  return {
    session,
    member,
    organization: member.organization,
  };
}

export async function requireAuth(): Promise<Session> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }

  return session;
}

export async function requireOrgMember(orgId: string) {
  const session = await requireAuth();
  return getOrgMemberForSession(session, orgId);
}

export async function requirePermission(orgId: string, permission: Permission) {
  const session = await requireAuth();
  const allowed = await canInOrg(session.user.id, orgId, permission);

  if (!allowed) {
    throw new ForbiddenError("无权执行该操作");
  }

  return getOrgMemberForSession(session, orgId);
}
