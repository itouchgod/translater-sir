"use server";

import { Prisma, MemberRole, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendVerificationEmail } from "@/lib/mail";
import { createOpaqueToken, hashToken } from "@/lib/token";
import { RegisterSchema, type RegisterInput } from "@/lib/validations/auth";
import { auditLog } from "@/utils/audit";
import { hashPassword } from "@/utils/password";
import { rateLimit } from "@/utils/rate-limit";

type RegisterActionState = {
  success: boolean;
  error: string | null;
};

function createOrganizationSlug(email: string) {
  const localPart = email.split("@")[0] ?? "user";
  const slugBase = localPart
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const suffix = Math.random().toString(36).slice(2, 8);

  return `${slugBase || "user"}-${suffix}`;
}

export async function registerAction(input: unknown): Promise<RegisterActionState> {
  const parsed = RegisterSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "注册信息无效" };
  }

  const { email, name, password } = parsed.data;

  try {
    const registerLimit = await rateLimit(email.toLowerCase(), "auth:register");
    if (!registerLimit.success) {
      return { success: false, error: "注册请求过于频繁，请稍后再试" };
    }

    const existingUser = await db.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existingUser) {
      return { success: false, error: "该邮箱已注册，请直接登录" };
    }

    const passwordHash = await hashPassword(password);
    const verificationToken = createOpaqueToken();
    const verificationTokenHash = hashToken(verificationToken);
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const created = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: UserRole.USER,
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: `${name} 的组织`,
          slug: createOrganizationSlug(email),
          members: {
            create: {
              userId: user.id,
              role: MemberRole.OWNER,
            },
          },
        },
      });

      await tx.dictionary.create({
        data: {
          organizationId: organization.id,
          name: "默认术语库",
          description: "注册时自动创建的默认术语库",
          isDefault: true,
        },
      });

      await tx.verificationToken.create({
        data: {
          identifier: `email:${email}`,
          token: verificationTokenHash,
          expires: verificationExpires,
        },
      });

      return { userId: user.id, organizationId: organization.id };
    });

    void auditLog({
      userId: created.userId,
      action: "user.register",
      resource: "User",
      resourceId: created.userId,
      metadata: { email, organizationId: created.organizationId },
    });
    void auditLog({
      userId: created.userId,
      action: "org.create",
      resource: "Organization",
      resourceId: created.organizationId,
      metadata: { organizationId: created.organizationId, name: `${name} 的组织` },
    });

    await sendVerificationEmail({
      email,
      token: verificationToken,
      name,
    });

    return { success: true, error: null };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "该邮箱或组织标识已存在，请重试" };
    }

    logger.error({ error, email }, "Register action failed");
    return { success: false, error: "注册失败，请稍后重试" };
  }
}

export type RegisterActionInput = RegisterInput;
