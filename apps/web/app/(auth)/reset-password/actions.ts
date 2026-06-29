"use server";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { hashToken } from "@/lib/token";
import { ResetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { hashPassword } from "@/utils/password";

type ResetPasswordActionState = {
  success: boolean;
  error: string | null;
};

export async function resetPasswordAction(
  input: unknown,
): Promise<ResetPasswordActionState> {
  const parsed = ResetPasswordSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "重置密码信息无效" };
  }

  const { email, token, password } = parsed.data;

  try {
    const tokenHash = hashToken(token);
    const verificationToken = await db.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: `password-reset:${email}`,
          token: tokenHash,
        },
      },
    });

    if (!verificationToken || verificationToken.expires < new Date()) {
      return { success: false, error: "重置链接已失效，请重新申请" };
    }

    const passwordHash = await hashPassword(password);

    await db.$transaction([
      db.user.update({
        where: { email },
        data: { passwordHash },
      }),
      db.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token,
          },
        },
      }),
    ]);

    return { success: true, error: null };
  } catch (error: unknown) {
    logger.error({ error, email }, "Reset password action failed");
    return { success: false, error: "重置密码失败，请稍后重试" };
  }
}

export type ResetPasswordActionInput = ResetPasswordInput;
