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
import { getR2PublicUrl, getSignedUploadUrl } from "@/lib/r2";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const PresignedAudioSchema = z.object({
  contentType: z.string().trim().min(1),
  timestamp: z.number().int().positive().optional(),
});

export const POST = withApiHandler(async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const meeting = await requireMeetingFileAccess(id);
  const parsed = PresignedAudioSchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "录音上传信息无效");
  }

  assertAudioContentType(parsed.data.contentType);

  const fileName = buildRecordingFileName(parsed.data.timestamp);
  const key = buildRecordingKey(meeting.organizationId, meeting.id, fileName);
  const uploadUrl = await getSignedUploadUrl(key, parsed.data.contentType, 300);

  return apiSuccess({
    uploadUrl,
    key,
    fileName,
    publicUrl: getR2PublicUrl(key),
    expiresIn: 300,
  });
});
