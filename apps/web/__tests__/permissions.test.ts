import { MemberRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { can, permissions, permissionMatrix, type Permission } from "@/utils/permissions";

const roles = [
  MemberRole.OWNER,
  MemberRole.ADMIN,
  MemberRole.MEMBER,
  MemberRole.VIEWER,
] as const;

const expected: Record<MemberRole, readonly Permission[]> = {
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

describe("can", () => {
  it("covers every role and permission combination", () => {
    for (const role of roles) {
      for (const permission of permissions) {
        expect(can(role, permission), `${role} ${permission}`).toBe(
          expected[role].includes(permission),
        );
      }
    }
  });

  it("does not allow viewers to create meetings", () => {
    expect(can(MemberRole.VIEWER, "meeting:create")).toBe(false);
  });

  it("allows owners to do everything", () => {
    for (const permission of permissions) {
      expect(can(MemberRole.OWNER, permission)).toBe(true);
    }
  });

  it("keeps the exported matrix aligned with expectations", () => {
    expect(permissionMatrix).toEqual(expected);
  });
});
