import { Prisma } from "@prisma/client";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requireOrgMember } from "@/lib/auth-helpers";
import { invalidateUserMeCache } from "@/lib/cache-invalidation";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { getR2Key, getR2PublicUrl, headR2Object, uploadToR2 } from "@/lib/r2";
import { ConfirmAvatarSchema } from "@/lib/validations/user";
import {
  getAllowedTypesForPurpose,
  getMaxSizeForPurpose,
  readMagicBytes,
  validateUpload,
} from "@/utils/upload-validation";

export const runtime = "nodejs";

function getAvatarFileExtension(contentType: string) {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      throw new ValidationError("头像文件类型不支持");
  }
}

async function updateAvatarUrl(userId: string, key: string) {
  try {
    const avatarUrl = getR2PublicUrl(key);
    const user = await db.user.update({
      where: {
        id: userId,
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

    await invalidateUserMeCache(userId);

    return user;
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("用户不存在");
    }

    throw error;
  }
}

export const POST = withApiHandler(async function POST(request: Request) {
  const session = await requireAuth();
  const contentType = request.headers.get("content-type") ?? "";
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    throw new ForbiddenError("当前账号没有可用组织");
  }

  await requireOrgMember(organizationId);

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ValidationError("请选择头像文件");
    }

    const magicBytes = await readMagicBytes(file);
    const validation = validateUpload(
      {
        type: file.type,
        size: file.size,
        magicBytes,
      },
      getAllowedTypesForPurpose("avatar"),
      getMaxSizeForPurpose("avatar"),
    );

    if (!validation.valid) {
      throw new ValidationError(validation.error);
    }

    const extension = getAvatarFileExtension(file.type);
    const key = getR2Key("avatar", organizationId, `${session.user.id}.${extension}`);
    const body = Buffer.from(await file.arrayBuffer());

    await uploadToR2({
      key,
      body,
      contentType: file.type,
    });

    return apiSuccess(await updateAvatarUrl(session.user.id, key));
  }

  const body = await request.json();
  const parsed = ConfirmAvatarSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "头像文件无效");
  }

  const expectedPrefix = getR2Key("avatar", organizationId);

  if (!parsed.data.key.startsWith(`${expectedPrefix}/`)) {
    throw new ForbiddenError("头像文件 Key 无效");
  }

  await headR2Object(parsed.data.key);

  return apiSuccess(await updateAvatarUrl(session.user.id, parsed.data.key));
});
