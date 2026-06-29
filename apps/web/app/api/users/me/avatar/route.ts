import { Prisma } from "@prisma/client";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { getR2Key, getR2PublicUrl, headR2Object } from "@/lib/r2";
import { ConfirmAvatarSchema } from "@/lib/validations/user";

export const POST = withApiHandler(async function POST(request: Request) {
  const session = await requireAuth();
  const body = await request.json();
  const parsed = ConfirmAvatarSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "头像文件无效");
  }

  const organizationId = session.user.organizationId;

  if (!organizationId) {
    throw new ForbiddenError("当前账号没有可用组织");
  }

  const expectedPrefix = getR2Key("avatar", organizationId);

  if (!parsed.data.key.startsWith(`${expectedPrefix}/`)) {
    throw new ForbiddenError("头像文件 Key 无效");
  }

  await headR2Object(parsed.data.key);

  try {
    const avatarUrl = getR2PublicUrl(parsed.data.key);
    const user = await db.user.update({
      where: {
        id: session.user.id,
        deletedAt: null,
      },
      data: {
        avatarUrl,
      },
      select: {
        id: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });

    return apiSuccess(user);
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("用户不存在");
    }

    throw error;
  }
});
