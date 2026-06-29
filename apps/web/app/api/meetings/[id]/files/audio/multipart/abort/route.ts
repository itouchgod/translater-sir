import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { ValidationError } from "@/lib/errors";
import { assertMeetingAudioKey, requireMeetingFileAccess } from "@/lib/meeting-files";
import { abortMultipartUpload } from "@/lib/r2";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MultipartAbortSchema = z.object({
  key: z.string().trim().min(1).max(512),
  uploadId: z.string().trim().min(1),
});

export const POST = withApiHandler(async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const meeting = await requireMeetingFileAccess(id);
  const parsed = MultipartAbortSchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "分片取消信息无效");
  }

  assertMeetingAudioKey({
    key: parsed.data.key,
    orgId: meeting.organizationId,
    meetingId: meeting.id,
  });

  await abortMultipartUpload({
    key: parsed.data.key,
    uploadId: parsed.data.uploadId,
  });

  return apiSuccess({ aborted: true });
});
