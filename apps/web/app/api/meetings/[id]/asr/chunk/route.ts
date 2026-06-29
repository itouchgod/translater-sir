import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requireOrgMember } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";
import { sendMeetingAudioChunk } from "@/lib/asr/meeting-session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const AudioChunkSchema = z.object({
  chunk: z.string().min(1),
  chunkId: z.string().optional(),
  mimeType: z.string().default("audio/webm;codecs=opus"),
  timestamp: z.number().optional(),
});

export const POST = withApiHandler(async function POST(request: Request, context: RouteContext) {
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new AppError("ASR_UNAVAILABLE", "语音识别服务暂不可用，请稍后再试", 503);
  }

  const session = await requireAuth();
  const { id } = await context.params;
  const meeting = await db.meeting.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      sourceLanguage: true,
      targetLanguage: true,
    },
  });

  if (!meeting) {
    throw new NotFoundError("会议不存在");
  }

  await requireOrgMember(meeting.organizationId);

  const body = AudioChunkSchema.safeParse(await request.json());

  if (!body.success) {
    throw new ValidationError("音频数据无效");
  }

  const chunk = Buffer.from(body.data.chunk, "base64");

  if (chunk.byteLength === 0) {
    throw new ValidationError("音频数据为空");
  }

  await sendMeetingAudioChunk(
    {
      meetingId: meeting.id,
      organizationId: meeting.organizationId,
      language: meeting.sourceLanguage,
      targetLanguage: meeting.targetLanguage,
      userId: session.user.id,
    },
    chunk,
  );

  return apiSuccess({
    accepted: true,
    chunkId: body.data.chunkId ?? null,
  });
});
