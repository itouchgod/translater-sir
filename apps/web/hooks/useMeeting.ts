"use client";

import useSWR from "swr";
import type { MeetingStatus } from "@prisma/client";

export type MeetingDetail = {
  id: string;
  organizationId: string;
  createdById: string;
  title: string;
  status: MeetingStatus;
  sourceLanguage: string;
  targetLanguage: string;
  startedAt: string | null;
  endedAt: string | null;
  audioUrl: string | null;
  summaryUrl: string | null;
  summaryText: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  files: Array<{
    id: string;
    meetingId: string;
    type: string;
    name: string;
    url: string;
    sizeBytes: number;
    createdAt: string;
  }>;
  _count: {
    segments: number;
    files: number;
  };
};

type MeetingResponse = {
  data: MeetingDetail | null;
  error: { message: string } | null;
};

async function fetchMeeting(url: string) {
  const response = await fetch(url);
  const payload = (await response.json()) as MeetingResponse;

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "获取会议详情失败");
  }

  return payload.data;
}

export function useMeeting(meetingId: string) {
  return useSWR(meetingId ? `/api/meetings/${encodeURIComponent(meetingId)}` : null, fetchMeeting, {
    refreshInterval: (meeting) =>
      meeting?.status === "LIVE" || meeting?.status === "PROCESSING" ? 5000 : 0,
  });
}
