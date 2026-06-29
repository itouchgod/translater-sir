"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { UpdateProfileSchema, type UpdateProfileInput } from "@/lib/validations/user";

type ProfileActionState = {
  success: boolean;
  error: string | null;
};

export async function updateProfileAction(input: unknown): Promise<ProfileActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "请先登录" };
  }

  const parsed = UpdateProfileSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "资料信息无效" };
  }

  try {
    await db.user.update({
      where: {
        id: session.user.id,
        deletedAt: null,
      },
      data: {
        name: parsed.data.name,
      },
    });

    revalidatePath("/settings/profile");
    return { success: true, error: null };
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { success: false, error: "用户不存在" };
    }

    logger.error({ error, userId: session.user.id }, "Profile update action failed");
    return { success: false, error: "更新资料失败，请稍后重试" };
  }
}

export async function deleteAccountAction(): Promise<ProfileActionState> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "请先登录" };
  }

  try {
    await db.user.update({
      where: {
        id: session.user.id,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return { success: true, error: null };
  } catch (error: unknown) {
    logger.error({ error, userId: session.user.id }, "Account delete action failed");
    return { success: false, error: "注销账号失败，请稍后重试" };
  }
}

export type UpdateProfileActionInput = UpdateProfileInput;
