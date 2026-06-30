"use server";

import { revalidatePath } from "next/cache";
import { update } from "@/lib/auth";
import { invalidateOrganizationCache } from "@/lib/cache-invalidation";
import { db } from "@/lib/db";
import { getR2Key, getR2PublicUrl } from "@/lib/r2";
import { canManageMembers, getOrganizationAccess } from "@/lib/organizations";
import { UpdateOrganizationSchema } from "@/lib/validations/organization";

type ActionState<TData = null> = {
  success: boolean;
  data?: TData;
  error: string | null;
};

export async function updateOrganizationAction(
  organizationId: string,
  input: unknown,
): Promise<ActionState<{ name: string; logoUrl: string | null }>> {
  const access = await getOrganizationAccess(organizationId);

  if (!access) {
    return { success: false, error: "组织不存在或无权访问" };
  }

  if (!canManageMembers(access.member.role)) {
    return { success: false, error: "只有 OWNER 或 ADMIN 可以修改组织信息" };
  }

  const parsed = UpdateOrganizationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "组织信息无效",
    };
  }

  const logoPrefix = getR2Key("organizationLogo", organizationId);

  if (parsed.data.logoKey && !parsed.data.logoKey.startsWith(`${logoPrefix}/`)) {
    return { success: false, error: "Logo 文件 Key 无效" };
  }

  const organization = await db.organization.update({
    where: { id: organizationId },
    data: {
      name: parsed.data.name,
      logoUrl: parsed.data.logoKey ? getR2PublicUrl(parsed.data.logoKey) : undefined,
    },
    select: {
      name: true,
      logoUrl: true,
    },
  });

  await invalidateOrganizationCache(organizationId);
  revalidatePath("/settings/organization");
  revalidatePath("/", "layout");

  return {
    success: true,
    data: organization,
    error: null,
  };
}

export async function switchOrganizationAction(organizationId: string): Promise<ActionState> {
  const access = await getOrganizationAccess(organizationId);

  if (!access) {
    return { success: false, error: "组织不存在或无权访问" };
  }

  await update({ user: { organizationId } });

  revalidatePath("/", "layout");

  return { success: true, error: null };
}
