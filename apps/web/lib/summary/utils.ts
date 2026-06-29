import { FileType, type Meeting, type MeetingSegment } from "@prisma/client";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getR2Key, uploadToR2 } from "@/lib/r2";
import { MeetingSummarySchema, type MeetingSummary, type SummaryExportFormat } from "@/lib/summary/types";

type MeetingForSummary = Pick<
  Meeting,
  | "id"
  | "organizationId"
  | "title"
  | "startedAt"
  | "endedAt"
  | "createdAt"
  | "summaryText"
  | "summaryUrl"
>;

type SegmentForSummary = Pick<
  MeetingSegment,
  "sequence" | "originalText" | "translatedText" | "startMs" | "endMs" | "createdAt"
>;

export type SummarySource = {
  meeting: MeetingForSummary & {
    organization: {
      name: string;
      logoUrl: string | null;
    };
  };
  segments: SegmentForSummary[];
};

export function formatDuration(startedAt: Date | null, endedAt: Date | null) {
  if (!startedAt || !endedAt) {
    return "未知";
  }

  const totalSeconds = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} 分 ${seconds} 秒`;
}

export function formatSegmentTimestamp(segment: Pick<MeetingSegment, "startMs" | "createdAt">) {
  if (segment.startMs > 0) {
    const totalSeconds = Math.floor(segment.startMs / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  return segment.createdAt.toISOString();
}

export function buildTranscript(segments: SegmentForSummary[]) {
  return segments.map((segment) => ({
    timestamp: formatSegmentTimestamp(segment),
    original: segment.originalText,
    translation: segment.translatedText,
  }));
}

export async function loadSummarySource(meetingId: string): Promise<SummarySource> {
  const meeting = await db.meeting.findUnique({
    where: { id: meetingId },
    include: {
      organization: {
        select: {
          name: true,
          logoUrl: true,
        },
      },
    },
  });

  if (!meeting) {
    throw new NotFoundError("会议不存在");
  }

  const segments = await db.meetingSegment.findMany({
    where: { meetingId },
    orderBy: { sequence: "asc" },
    select: {
      sequence: true,
      originalText: true,
      translatedText: true,
      startMs: true,
      endMs: true,
      createdAt: true,
    },
  });

  return { meeting, segments };
}

export function parseStoredSummary(summaryText: string | null): MeetingSummary | null {
  if (!summaryText) {
    return null;
  }

  try {
    return MeetingSummarySchema.parse(JSON.parse(summaryText));
  } catch {
    return null;
  }
}

export async function requireMeetingSummary(meetingId: string) {
  const source = await loadSummarySource(meetingId);
  const summary = parseStoredSummary(source.meeting.summaryText);

  if (!summary) {
    throw new ValidationError("会议纪要尚未生成");
  }

  return {
    ...source,
    summary,
  };
}

export function buildPlainTextSummary(summary: MeetingSummary) {
  const lines = [
    summary.title,
    "",
    `日期：${summary.date}`,
    `时长：${summary.duration}`,
    "",
    "概览",
    summary.overview,
    "",
    "要点",
    ...summary.keyPoints.map((item) => `- ${item}`),
    "",
    "决策",
    ...summary.decisions.map((item) => `- ${item}`),
    "",
    "待办",
    ...summary.actionItems.map((item) => `- ${item.task}${item.owner ? `（负责人：${item.owner}）` : ""}${item.deadline ? ` 截止：${item.deadline}` : ""}`),
    "",
    "亮点",
    ...summary.highlights.map((item) => `- ${item}`),
    "",
    "逐字稿",
    ...summary.transcript.flatMap((item) => [
      `[${item.timestamp}] ${item.original}`,
      item.translation ? `译文：${item.translation}` : "",
    ]),
  ];

  return lines.filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n");
}

export function getSummaryExportFile(format: SummaryExportFormat) {
  switch (format) {
    case "pdf":
      return {
        fileName: "summary.pdf",
        contentType: "application/pdf",
        type: FileType.SUMMARY_PDF,
      };
    case "docx":
      return {
        fileName: "summary.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        type: FileType.SUMMARY_DOCX,
      };
    case "txt":
      return {
        fileName: "summary.txt",
        contentType: "text/plain; charset=utf-8",
        type: FileType.SUMMARY_TXT,
      };
  }
}

export async function saveSummaryExport(params: {
  meetingId: string;
  organizationId: string;
  format: SummaryExportFormat;
  body: Buffer | string;
}) {
  const file = getSummaryExportFile(params.format);
  const key = getR2Key("meetingExport", params.organizationId, params.meetingId, file.fileName);
  const body =
    typeof params.body === "string" ? Buffer.from(params.body, "utf8") : params.body;
  const url = await uploadToR2({
    key,
    body,
    contentType: file.contentType,
  });
  const meetingFile = await db.meetingFile.upsert({
    where: {
      id:
        (
          await db.meetingFile.findFirst({
            where: {
              meetingId: params.meetingId,
              type: file.type,
              name: file.fileName,
            },
            select: { id: true },
          })
        )?.id ?? "__missing_summary_export__",
    },
    update: {
      url,
      sizeBytes: body.byteLength,
    },
    create: {
      meetingId: params.meetingId,
      type: file.type,
      name: file.fileName,
      url,
      sizeBytes: body.byteLength,
    },
  });

  if (params.format === "pdf") {
    await db.meeting.update({
      where: { id: params.meetingId },
      data: { summaryUrl: url },
    });
  }

  return {
    url,
    key,
    file: meetingFile,
  };
}
