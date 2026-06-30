"use server";

import { headers } from "next/headers";
import { getToken } from "next-auth/jwt";
import { signOut } from "@/lib/auth";
import { addToBlacklist } from "@/lib/jwt-blacklist";
import { logger } from "@/lib/logger";
import { auditLog } from "@/utils/audit";

type LogoutActionState = {
  success: boolean;
  error: string | null;
};

export async function logoutAction(): Promise<LogoutActionState> {
  try {
    const requestHeaders = await headers();
    const token = await getToken({
      req: { headers: requestHeaders },
      secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    });

    if (token?.jti) {
      const expiresAt = typeof token.exp === "number" ? token.exp : Date.now() + 15 * 60 * 1000;
      await addToBlacklist(token.jti, expiresAt);
    }

    if (token?.userId) {
      void auditLog({
        userId: token.userId,
        action: "user.logout",
        resource: "User",
        resourceId: token.userId,
        metadata: { organizationId: token.organizationId ?? null },
      });
    }

    await signOut({ redirect: false });

    return { success: true, error: null };
  } catch (error: unknown) {
    logger.error({ error }, "Logout action failed");
    return { success: false, error: "退出登录失败，请稍后重试" };
  }
}
