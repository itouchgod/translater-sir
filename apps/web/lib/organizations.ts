import { MemberRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { RedisKeys } from "@/utils/redis-keys";
import { RedisTTL } from "@/utils/redis-ttl";

export const INVITATION_TTL_SECONDS = RedisTTL.INVITATION;

export type InvitationPayload = {
  orgId: string;
  email: string;
  role: MemberRole;
  invitedBy: string;
};

export type OrganizationAccess = NonNullable<Awaited<ReturnType<typeof getOrganizationAccess>>>;

export function canManageMembers(role: MemberRole) {
  return role === MemberRole.OWNER || role === MemberRole.ADMIN;
}

export function createSlugBase(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "organization"
  );
}

export function createOrganizationSlug(name: string) {
  const suffix = crypto.randomUUID().slice(0, 8);
  return `${createSlugBase(name)}-${suffix}`;
}

export async function getOrganizationAccess(organizationId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const member = await db.member.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId,
      },
    },
    include: {
      organization: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!member || member.user.deletedAt) {
    return null;
  }

  return {
    session,
    member,
    organization: member.organization,
  };
}

export async function countOrganizationOwners(organizationId: string) {
  return db.member.count({
    where: {
      organizationId,
      role: MemberRole.OWNER,
      user: {
        deletedAt: null,
      },
    },
  });
}

export async function storeInvitationToken(token: string, payload: InvitationPayload) {
  await redis.setex(RedisKeys.invitation(token), RedisTTL.INVITATION, JSON.stringify(payload));
}

export async function consumeInvitationToken(token: string) {
  const key = RedisKeys.invitation(token);
  const raw = await redis.eval(
    "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value",
    1,
    key,
  );

  if (typeof raw !== "string") {
    return null;
  }

  const parsed = parseInvitationPayload(raw);

  return parsed;
}

export async function peekInvitationToken(token: string) {
  const raw = await redis.get(RedisKeys.invitation(token));

  if (!raw) {
    return null;
  }

  const parsed = parseInvitationPayload(raw);

  return parsed;
}

const invitationPayloadSchema = z.object({
  orgId: z.string().min(1),
  email: z.email(),
  role: z.enum([MemberRole.ADMIN, MemberRole.MEMBER, MemberRole.VIEWER]),
  invitedBy: z.string().min(1),
});

function parseInvitationPayload(raw: string) {
  try {
    const parsed = invitationPayloadSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) {
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}
