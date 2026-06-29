"use server";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendPasswordResetEmail } from "@/lib/mail";
import { createOpaqueToken, hashToken } from "@/lib/token";
import {
  ForgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validations/auth";

type ForgotPasswordActionState = {
  success: boolean;
  error: string | null;
};

export async function forgotPasswordAction(
  input: unknown,
): Promise<ForgotPasswordActionState> {
  const parsed = ForgotPasswordSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "邮箱无效" };
  }

  const { email } = parsed.data;

  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (user) {
      const token = createOpaqueToken();
      const tokenHash = hashToken(token);
      const expires = new Date(Date.now() + 30 * 60 * 1000);

      await db.verificationToken.create({
        data: {
          identifier: `password-reset:${email}`,
          token: tokenHash,
          expires,
        },
      });

      await sendPasswordResetEmail({ email, token });
    }

    return { success: true, error: null };
  } catch (error: unknown) {
    logger.error({ error, email }, "Forgot password action failed");
    return { success: false, error: "发送重置邮件失败，请稍后重试" };
  }
}

export type ForgotPasswordActionInput = ForgotPasswordInput;
