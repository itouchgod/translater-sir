import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { requireMeetingSummary, saveSummaryExport } from "@/lib/summary/utils";
import type { MeetingSummary } from "@/lib/summary/types";

const styles = StyleSheet.create({
  page: {
    padding: 42,
    fontSize: 10,
    color: "#111827",
    fontFamily: "Helvetica",
  },
  titlePage: {
    padding: 56,
    fontSize: 11,
    color: "#111827",
    fontFamily: "Helvetica",
  },
  logo: {
    width: 72,
    height: 72,
    objectFit: "contain",
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    marginBottom: 18,
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 12,
    color: "#4b5563",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 8,
    fontWeight: 700,
  },
  paragraph: {
    lineHeight: 1.5,
    marginBottom: 6,
  },
  bullet: {
    lineHeight: 1.45,
    marginBottom: 4,
  },
  transcriptItem: {
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 7,
    marginBottom: 7,
  },
  timestamp: {
    color: "#6b7280",
    marginBottom: 3,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 42,
    right: 42,
    color: "#9ca3af",
    fontSize: 9,
    textAlign: "center",
  },
});

function listItems(items: string[]) {
  if (items.length === 0) {
    return [React.createElement(Text, { key: "empty", style: styles.paragraph }, "无")];
  }

  return items.map((item, index) =>
    React.createElement(Text, { key: `${index}-${item}`, style: styles.bullet }, `• ${item}`),
  );
}

function summaryBody(summary: MeetingSummary) {
  return [
    React.createElement(Text, { key: "overview-title", style: styles.sectionTitle }, "概览"),
    React.createElement(Text, { key: "overview", style: styles.paragraph }, summary.overview),
    React.createElement(Text, { key: "points-title", style: styles.sectionTitle }, "要点"),
    ...listItems(summary.keyPoints),
    React.createElement(Text, { key: "decisions-title", style: styles.sectionTitle }, "决策"),
    ...listItems(summary.decisions),
    React.createElement(Text, { key: "actions-title", style: styles.sectionTitle }, "待办"),
    ...(summary.actionItems.length > 0
      ? summary.actionItems.map((item) =>
          React.createElement(
            Text,
            { key: `${item.task}-${item.owner ?? ""}`, style: styles.bullet },
            `• ${item.task}${item.owner ? `（负责人：${item.owner}）` : ""}${
              item.deadline ? ` 截止：${item.deadline}` : ""
            }`,
          ),
        )
      : [React.createElement(Text, { key: "actions-empty", style: styles.paragraph }, "无")]),
    React.createElement(Text, { key: "highlights-title", style: styles.sectionTitle }, "亮点"),
    ...listItems(summary.highlights),
  ];
}

function footer() {
  return React.createElement(Text, {
    style: styles.footer,
    fixed: true,
    render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
      `${pageNumber} / ${totalPages}`,
  });
}

export async function exportToPdf(meetingId: string) {
  const { meeting, summary } = await requireMeetingSummary(meetingId);
  const document = React.createElement(
    Document,
    { title: summary.title, author: meeting.organization.name },
    React.createElement(
      Page,
      { size: "A4", style: styles.titlePage },
      meeting.organization.logoUrl
        ? React.createElement(Image, { src: meeting.organization.logoUrl, style: styles.logo })
        : null,
      React.createElement(Text, { style: styles.title }, summary.title),
      React.createElement(Text, { style: styles.subtitle }, `组织：${meeting.organization.name}`),
      React.createElement(Text, { style: styles.subtitle }, `日期：${summary.date}`),
      React.createElement(Text, { style: styles.subtitle }, `时长：${summary.duration}`),
      footer(),
    ),
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.title }, "会议纪要"),
      ...summaryBody(summary),
      footer(),
    ),
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.title }, "逐字稿附录"),
      ...summary.transcript.map((item) =>
        React.createElement(
          View,
          { key: `${item.timestamp}-${item.original.slice(0, 12)}`, style: styles.transcriptItem },
          React.createElement(Text, { style: styles.timestamp }, item.timestamp),
          React.createElement(Text, { style: styles.paragraph }, item.original),
          item.translation
            ? React.createElement(Text, { style: styles.paragraph }, `译文：${item.translation}`)
            : null,
        ),
      ),
      footer(),
    ),
  );
  const buffer = await renderToBuffer(document);

  return saveSummaryExport({
    meetingId: meeting.id,
    organizationId: meeting.organizationId,
    format: "pdf",
    body: buffer,
  });
}
