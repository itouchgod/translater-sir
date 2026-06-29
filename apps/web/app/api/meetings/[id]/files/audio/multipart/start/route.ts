import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { ValidationError } from "@/lib/errors";
import {
  assertAudioContentType,
  buildRecordingFileName,
  buildRecordingKey,
  requireMeetingFileAccess,
} from "@/lib/meeting-files";
import { createMultipartUpload, getR2PublicUrl, getSignedUploadPartUrl } from "@/lib/r2";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MultipartStartSchema = z.object({
  contentType: z.string().trim().min(1),
  partCount: z.number().int().min(1).max(10000),
  timestamp: z.number().int().positive().optional(),
});

export const POST = withApiHandler(async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const meeting = await requireMeetingFileAccess(id);
  const parsed = MultipartStartSchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "分片上传信息无效");
  }

  assertAudioContentType(parsed.data.contentType);

  const fileName = buildRecordingFileName(parsed.data.timestamp);
  const key = buildRecordingKey(meeting.organizationId, meeting.id, fileName);
  const multipart = await createMultipartUpload({
    key,
    contentType: parsed.data.contentType,
  });
  const parts = await Promise.all(
    Array.from({ length: parsed.data.partCount }, async (_, index) => {
      const partNumber = index + 1;

      return {
        partNumber,
        uploadUrl: await getSignedUploadPartUrl({
          key,
          uploadId: multipart.uploadId,
          partNumber,
          expiresIn: 900,
        }),
      };
    }),
  );

  return apiSuccess({
    key,
    fileName,
    uploadId: multipart.uploadId,
    publicUrl: getR2PublicUrl(key),
    parts,
  });
});
