import { buildPlainTextSummary, requireMeetingSummary, saveSummaryExport } from "@/lib/summary/utils";

export async function exportToTxt(meetingId: string) {
  const { meeting, summary } = await requireMeetingSummary(meetingId);
  const content = buildPlainTextSummary(summary);

  return saveSummaryExport({
    meetingId: meeting.id,
    organizationId: meeting.organizationId,
    format: "txt",
    body: content,
  });
}
