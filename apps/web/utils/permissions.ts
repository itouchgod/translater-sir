import { MemberRole } from "@prisma/client";
import { db } from "@/lib/db";

export type Permission =
  | "meeting:create"
  | "meeting:delete"
  | "meeting:view"
  | "member:manage"
  | "dictionary:manage"
  | "billing:view"
  | "billing:manage"
  | "apikey:manage"
  | "webhook:manage"
  | "admin:access";

export const permissions = [
  "meeting:create",
  "meeting:delete",
  "meeting:view",
  "member:manage",
  "dictionary:manage",
  "billing:view",
  "billing:manage",
  "apikey:manage",
  "webhook:manage",
  "admin:access",
] as const satisfies readonly Permission[];

export const permissionMatrix: Record<MemberRole, readonly Permission[]> = {
  [MemberRole.OWNER]: permissions,
  [MemberRole.ADMIN]: [
    "meeting:create",
    "meeting:delete",
    "meeting:view",
    "member:manage",
    "dictionary:manage",
    "billing:view",
    "apikey:manage",
    "webhook:manage",
  ],
  [MemberRole.MEMBER]: ["meeting:create", "meeting:view", "dictionary:manage"],
  [MemberRole.VIEWER]: ["meeting:view"],
};

const PERMISSION_CACHE_TTL_MS = 60 * 1000;

type CachedRole = {
  role: MemberRole | null;
  expiresAt: number;
};

const memberRoleCache = new Map<string, CachedRole>();

function getCacheKey(userId: string, orgId: string) {
  return `${userId}:${orgId}`;
}

export function can(role: MemberRole, permission: Permission): boolean {
  return permissionMatrix[role].includes(permission);
}

export function invalidateOrgPermissionCache(orgId: string) {
  for (const key of memberRoleCache.keys()) {
    if (key.endsWith(`:${orgId}`)) {
      memberRoleCache.delete(key);
    }
  }
}

export function clearPermissionCache() {
  memberRoleCache.clear();
}

export async function canInOrg(
  userId: string,
  orgId: string,
  permission: Permission,
): Promise<boolean> {
  const cacheKey = getCacheKey(userId, orgId);
  const cached = memberRoleCache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.role ? can(cached.role, permission) : false;
  }

  const member = await db.member.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: orgId,
      },
    },
    select: {
      role: true,
      user: {
        select: {
          deletedAt: true,
        },
      },
    },
  });

  const role = member && !member.user.deletedAt ? member.role : null;
  memberRoleCache.set(cacheKey, {
    role,
    expiresAt: now + PERMISSION_CACHE_TTL_MS,
  });

  return role ? can(role, permission) : false;
}
