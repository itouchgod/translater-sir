import { randomUUID } from "node:crypto";
import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requireOrgMember } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { getR2Key, getR2PublicUrl, getSignedUploadUrl } from "@/lib/r2";
import { withRateLimit } from "@/lib/with-rate-limit";
import {
  getAllowedTypesForPurpose,
  getMaxSizeForPurpose,
  validateUpload,
  type UploadPurpose,
} from "@/utils/upload-validation";

function getFileExtension(contentType: string) {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

const PresignedUploadSchema = z.object({
  key: z.string().trim().min(1).max(512).optional(),
  fileName: z.string().trim().min(1).max(180).optional(),
  contentType: z.string().trim().min(1),
  fileSize: z.number().int().positive().optional(),
  sizeBytes: z.number().int().positive().optional(),
  magicBytes: z.string().trim().min(6).max(24).optional(),
  purpose: z.enum(["avatar", "audio", "attachment"]).default("avatar"),
  meetingId: z.string().trim().min(1).optional(),
});

function basename(fileName: string | undefined, fallback: string) {
  return (fileName ?? fallback).trim().split(/[/\\]/).filter(Boolean).at(-1) ?? fallback;
}

async function createUploadKey(params: {
  requestedKey?: string;
  purpose: UploadPurpose;
  organizationId: string;
  userId: string;
  meetingId?: string;
  fileName?: string;
  contentType: string;
}) {
  if (params.requestedKey) {
    return params.requestedKey;
  }

  const extension = getFileExtension(params.contentType);

  if (params.purpose === "avatar") {
    return getR2Key("avatar", params.organizationId, `${params.userId}.${extension}`);
  }

  if (!params.meetingId) {
    throw new ValidationError("会议 ID 不能为空");
  }

  const meeting = await db.meeting.findUnique({
    where: { id: params.meetingId },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!meeting) {
    throw new NotFoundError("会议不存在");
  }

  if (meeting.organizationId !== params.organizationId) {
    throw new ForbiddenError("无权上传到该会议");
  }

  const fileName = `${randomUUID()}-${basename(params.fileName, `file.${extension}`)}`;

  return params.purpose === "audio"
    ? getR2Key("meetingAudio", params.organizationId, params.meetingId, fileName)
    : getR2Key("meetingAttachment", params.organizationId, params.meetingId, fileName);
}

export const POST = withRateLimit("api:upload")(
  withApiHandler(async function POST(request: Request) {
  const session = await requireAuth();
  const body = await request.json();
  const parsed = PresignedUploadSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "上传信息无效");
  }

  const size = parsed.data.fileSize ?? parsed.data.sizeBytes;

  if (!size) {
    throw new ValidationError("文件大小不能为空");
  }

  const validation = validateUpload(
    { type: parsed.data.contentType, size, magicBytes: parsed.data.magicBytes },
    getAllowedTypesForPurpose(parsed.data.purpose),
    getMaxSizeForPurpose(parsed.data.purpose),
  );

  if (!validation.valid) {
    throw new ValidationError(validation.error);
  }

  const organizationId = session.user.organizationId;

  if (!organizationId) {
    throw new ForbiddenError("当前账号没有可用组织");
  }

  await requireOrgMember(organizationId);

  const key = await createUploadKey({
    requestedKey: parsed.data.key,
    purpose: parsed.data.purpose,
    organizationId,
    userId: session.user.id,
    meetingId: parsed.data.meetingId,
    fileName: parsed.data.fileName,
    contentType: parsed.data.contentType,
  });

  const organizationPrefix = getR2Key("organizationRoot", organizationId);

  if (!key.startsWith(`${organizationPrefix}/`)) {
    throw new ForbiddenError("文件 Key 无效");
  }

  /*
   * For objects larger than 10MB, keep using presigned direct upload for now.
   * When upload reliability becomes critical, switch this branch to S3-compatible
   * Multipart Upload: create multipart upload, presign each UploadPart, then complete.
   */
  const uploadUrl = await getSignedUploadUrl(key, parsed.data.contentType, 300);

  return apiSuccess({
    uploadUrl,
    key,
    publicUrl: getR2PublicUrl(key),
    expiresIn: 300,
  });
  }),
);
