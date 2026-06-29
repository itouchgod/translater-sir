"use client";

import useSWRInfinite from "swr/infinite";
import type { MeetingStatus } from "@prisma/client";

export type MeetingListItem = {
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
  _count: {
    segments: number;
    files: number;
  };
  files: Array<{
    id: string;
    type: string;
    name: string;
    sizeBytes: number;
    createdAt: string;
  }>;
};

type MeetingsResponse = {
  data: {
    items: MeetingListItem[];
    nextCursor: string | null;
    hasMore: boolean;
  } | null;
  error: { message: string } | null;
};

type UseMeetingsFilters = {
  status?: MeetingStatus | "ALL";
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

async function fetchMeetings(url: string) {
  const response = await fetch(url);
  const payload = (await response.json()) as MeetingsResponse;

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "获取会议列表失败");
  }

  return payload.data;
}

export function useMeetings(filters: UseMeetingsFilters = {}) {
  const limit = filters.limit ?? 20;
  const getKey = (
    pageIndex: number,
    previousPageData: Awaited<ReturnType<typeof fetchMeetings>> | null,
  ) => {
    if (previousPageData && !previousPageData.hasMore) {
      return null;
    }

    const params = new URLSearchParams({
      limit: String(limit),
    });

    if (filters.status && filters.status !== "ALL") {
      params.set("status", filters.status);
    }

    if (filters.dateFrom) {
      params.set("dateFrom", filters.dateFrom);
    }

    if (filters.dateTo) {
      params.set("dateTo", filters.dateTo);
    }

    if (pageIndex > 0 && previousPageData?.nextCursor) {
      params.set("cursor", previousPageData.nextCursor);
    }

    return `/api/meetings?${params.toString()}`;
  };
  const swr = useSWRInfinite(getKey, fetchMeetings);
  const pages = swr.data ?? [];
  const meetings = pages.flatMap((page) => page.items);
  const lastPage = pages.at(-1);

  return {
    ...swr,
    meetings,
    hasMore: lastPage?.hasMore ?? false,
    loadMore: () => swr.setSize((size) => size + 1),
  };
}
