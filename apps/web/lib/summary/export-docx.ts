import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { requireMeetingSummary, saveSummaryExport } from "@/lib/summary/utils";

type HeadingLevelValue = (typeof HeadingLevel)[keyof typeof HeadingLevel];

function heading(text: string, level: HeadingLevelValue = HeadingLevel.HEADING_2) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 240, after: 120 },
  });
}

function paragraph(text: string) {
  return new Paragraph({
    children: [new TextRun(text)],
    spacing: { after: 120 },
  });
}

function bullet(text: string) {
  return new Paragraph({
    children: [new TextRun(text)],
    bullet: { level: 0 },
  });
}

export async function exportToDocx(meetingId: string) {
  const { meeting, summary } = await requireMeetingSummary(meetingId);
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          heading(summary.title, HeadingLevel.HEADING_1),
          paragraph(`组织：${meeting.organization.name}`),
          paragraph(`日期：${summary.date}`),
          paragraph(`时长：${summary.duration}`),
          heading("概览"),
          paragraph(summary.overview),
          heading("要点"),
          ...summary.keyPoints.map(bullet),
          heading("决策"),
          ...summary.decisions.map(bullet),
          heading("待办"),
          ...summary.actionItems.map((item) =>
            bullet(
              `${item.task}${item.owner ? `（负责人：${item.owner}）` : ""}${
                item.deadline ? ` 截止：${item.deadline}` : ""
              }`,
            ),
          ),
          heading("亮点"),
          ...summary.highlights.map(bullet),
          heading("逐字稿附录"),
          ...summary.transcript.flatMap((item) => [
            paragraph(`[${item.timestamp}] ${item.original}`),
            ...(item.translation ? [paragraph(`译文：${item.translation}`)] : []),
          ]),
        ],
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);

  return saveSummaryExport({
    meetingId: meeting.id,
    organizationId: meeting.organizationId,
    format: "docx",
    body: buffer,
  });
}
