"use client";

import useSWR from "swr";

export type MeetingFileItem = {
  id: string;
  meetingId: string;
  type: string;
  name: string;
  url: string;
  sizeBytes: number;
  createdAt: string;
};

type FilesResponse = {
  data: MeetingFileItem[] | null;
  error: { message: string } | null;
};

async function fetchMeetingFiles(url: string) {
  const response = await fetch(url);
  const payload = (await response.json()) as FilesResponse;

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "获取会议文件失败");
  }

  return payload.data;
}

export function useMeetingFiles(meetingId: string, fallbackData?: MeetingFileItem[]) {
  return useSWR(
    meetingId ? `/api/meetings/${encodeURIComponent(meetingId)}/files` : null,
    fetchMeetingFiles,
    {
      fallbackData,
    },
  );
}
