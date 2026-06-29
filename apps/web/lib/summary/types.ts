import { z } from "zod";

export const SummaryActionItemSchema = z.object({
  task: z.string().trim().min(1),
  owner: z.string().trim().optional(),
  deadline: z.string().trim().optional(),
});

export const SummaryTranscriptItemSchema = z.object({
  timestamp: z.string().trim(),
  original: z.string(),
  translation: z.string().nullable().optional(),
});

export const MeetingSummarySchema = z.object({
  title: z.string().trim().min(1),
  date: z.string().trim().min(1),
  duration: z.string().trim().min(1),
  participants: z.array(z.string().trim()).default([]),
  overview: z.string().trim().min(1),
  keyPoints: z.array(z.string().trim()).default([]),
  decisions: z.array(z.string().trim()).default([]),
  actionItems: z.array(SummaryActionItemSchema).default([]),
  highlights: z.array(z.string().trim()).default([]),
  transcript: z.array(SummaryTranscriptItemSchema).default([]),
});

export type MeetingSummary = z.infer<typeof MeetingSummarySchema>;

export type SummaryExportFormat = "pdf" | "docx" | "txt";
