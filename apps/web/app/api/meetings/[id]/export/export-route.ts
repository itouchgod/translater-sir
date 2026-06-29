import { NextResponse } from "next/server";
import type { SummaryExportFormat } from "@/lib/summary/types";
import { requireMeetingFileAccess } from "@/lib/meeting-files";
import { exportToDocx } from "@/lib/summary/export-docx";
import { exportToPdf } from "@/lib/summary/export-pdf";
import { exportToTxt } from "@/lib/summary/export-txt";

type ExporterResult = {
  file: {
    id: string;
  };
};

async function exportByFormat(format: SummaryExportFormat, meetingId: string): Promise<ExporterResult> {
  switch (format) {
    case "pdf":
      return exportToPdf(meetingId);
    case "docx":
      return exportToDocx(meetingId);
    case "txt":
      return exportToTxt(meetingId);
  }
}

export async function handleSummaryExport(request: Request, meetingId: string, format: SummaryExportFormat) {
  await requireMeetingFileAccess(meetingId);
  const result = await exportByFormat(format, meetingId);
  return NextResponse.redirect(new URL(`/api/download/${result.file.id}`, request.url), 303);
}
