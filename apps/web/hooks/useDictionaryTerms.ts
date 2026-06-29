"use client";

import useSWRInfinite from "swr/infinite";

export type DictionaryTermItem = {
  id: string;
  dictionaryId: string;
  source: string;
  target: string;
  language: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type TermsPage = {
  items: DictionaryTermItem[];
  totalTerms: number;
  totalCount: number;
  nextCursor: string | null;
  hasMore: boolean;
};

type TermsResponse = {
  data: TermsPage | null;
  error: { message: string } | null;
};

type UseDictionaryTermsOptions = {
  query?: string;
  limit?: number;
  enabled?: boolean;
};

async function fetchTerms(url: string) {
  const response = await fetch(url);
  const payload = (await response.json()) as TermsResponse;

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "获取术语失败");
  }

  return payload.data;
}

export function useDictionaryTerms(dictionaryId: string, options: UseDictionaryTermsOptions = {}) {
  const limit = options.limit ?? 50;
  const query = options.query?.trim();
  const enabled = options.enabled ?? true;
  const getKey = (pageIndex: number, previousPageData: TermsPage | null) => {
    if (!enabled || !dictionaryId || (previousPageData && !previousPageData.hasMore)) {
      return null;
    }

    const params = new URLSearchParams({
      limit: String(limit),
    });

    if (query) {
      params.set("q", query);
    }

    if (pageIndex > 0 && previousPageData?.nextCursor) {
      params.set("cursor", previousPageData.nextCursor);
    }

    return `/api/dictionaries/${encodeURIComponent(dictionaryId)}/terms?${params.toString()}`;
  };
  const swr = useSWRInfinite(getKey, fetchTerms);
  const pages = swr.data ?? [];
  const terms = pages.flatMap((page) => page.items);
  const firstPage = pages[0];
  const lastPage = pages.at(-1);

  return {
    ...swr,
    terms,
    totalTerms: firstPage?.totalTerms ?? 0,
    totalCount: firstPage?.totalCount ?? 0,
    hasMore: lastPage?.hasMore ?? false,
    loadMore: () => swr.setSize((size) => size + 1),
  };
}
