"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { clearFailedLogins } from "@/lib/rate-limit";
import { LoginSchema, type LoginInput } from "@/lib/validations/auth";
import { verifyPassword } from "@/utils/password";
import { rateLimit } from "@/utils/rate-limit";
import { auditLog } from "@/utils/audit";

export type AuthActionState = {
  success: boolean;
  error: string | null;
  redirectTo?: string;
};

const invalidCredentialsMessage = "邮箱或密码不正确";
const rateLimitMessage = "登录失败次数过多，请 15 分钟后重试";

export async function loginAction(input: unknown): Promise<AuthActionState> {
  const parsed = LoginSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "登录信息无效" };
  }

  const { email, password } = parsed.data;

  try {
    const loginLimit = await rateLimit(email.toLowerCase(), "auth:login");
    if (!loginLimit.success) {
      void auditLog({
        action: "user.login.failure",
        resource: "User",
        metadata: { email, reason: "rate_limited" },
      });
      return { success: false, error: rateLimitMessage };
    }

    const user = await db.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user?.passwordHash) {
      void auditLog({
        action: "user.login.failure",
        resource: "User",
        metadata: { email, reason: "invalid_credentials" },
      });
      return { success: false, error: invalidCredentialsMessage };
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);

    if (!passwordMatches) {
      void auditLog({
        userId: user.id,
        action: "user.login.failure",
        resource: "User",
        resourceId: user.id,
        metadata: { email, reason: "invalid_credentials" },
      });
      return { success: false, error: invalidCredentialsMessage };
    }

    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    void auditLog({
      userId: user.id,
      action: "user.login.success",
      resource: "User",
      resourceId: user.id,
      metadata: { email },
    });
    await clearFailedLogins(email);

    return { success: true, error: null, redirectTo: "/dashboard" };
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      void auditLog({
        action: "user.login.failure",
        resource: "User",
        metadata: { email, reason: "auth_error" },
      });
      return { success: false, error: invalidCredentialsMessage };
    }

    logger.error({ error, email }, "Login action failed");
    return { success: false, error: "登录失败，请稍后重试" };
  }
}

export async function googleSignInAction() {
  await signIn("google", {
    redirectTo: "/dashboard",
  });
}

export type LoginActionInput = LoginInput;
