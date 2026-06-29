import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireOrgMember } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { publishRealtimeMessage } from "@/lib/realtime";
import type { WsMessage } from "@/types/websocket";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const TestMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subtitle"),
    data: z.object({
      segmentId: z.string().min(1),
      text: z.string().min(1),
      isFinal: z.boolean(),
      language: z.string().min(1),
      timestamp: z.number(),
    }),
  }),
  z.object({
    type: z.literal("translation"),
    data: z.object({
      segmentId: z.string().min(1),
      originalText: z.string().min(1),
      translatedText: z.string().min(1),
      sourceLanguage: z.string().min(1),
      targetLanguage: z.string().min(1),
    }),
  }),
]);

export const POST = withApiHandler(async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const meeting = await db.meeting.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!meeting) {
    throw new NotFoundError("会议不存在");
  }

  await requireOrgMember(meeting.organizationId);

  const parsed = TestMessageSchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "消息内容无效");
  }

  const message = parsed.data satisfies WsMessage;
  await publishRealtimeMessage(id, message);

  return apiSuccess({ published: true });
});
