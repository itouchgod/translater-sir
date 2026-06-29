import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireMeetingFileAccess } from "@/lib/meeting-files";
import { loadSummarySource, parseStoredSummary } from "@/lib/summary/utils";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const GET = withApiHandler(async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  await requireMeetingFileAccess(id);
  const source = await loadSummarySource(id);
  const summary = parseStoredSummary(source.meeting.summaryText);

  return apiSuccess({
    status: summary ? "ready" : "empty",
    summary,
    summaryUrl: source.meeting.summaryUrl,
  });
});
