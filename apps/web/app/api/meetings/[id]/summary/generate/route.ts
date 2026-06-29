import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth-helpers";
import { generateMeetingSummary } from "@/lib/summary/generate";
import { loadSummarySource, parseStoredSummary } from "@/lib/summary/utils";
import { requireMeetingFileAccess } from "@/lib/meeting-files";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const GenerateSummarySchema = z.object({
  force: z.boolean().optional(),
});

export const POST = withApiHandler(async function POST(request: Request, context: RouteContext) {
  const session = await requireAuth();
  const { id } = await context.params;
  await requireMeetingFileAccess(id);
  const body = await request.json().catch(() => ({}));
  const parsed = GenerateSummarySchema.safeParse(body);
  const force = parsed.success ? parsed.data.force ?? false : false;
  const source = await loadSummarySource(id);
  const existing = parseStoredSummary(source.meeting.summaryText);

  if (existing && !force) {
    return apiSuccess({
      status: "ready",
      summary: existing,
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new AppError("SUMMARY_UNAVAILABLE", "纪要生成服务暂不可用，请稍后再试", 503);
  }

  void generateMeetingSummary({
    meetingId: id,
    userId: session.user.id,
    force,
  }).catch((error: unknown) => {
    logger.error({ error, meetingId: id }, "Async summary generation failed");
  });

  return apiSuccess(
    {
      status: "processing",
    },
    { status: 202 },
  );
});
