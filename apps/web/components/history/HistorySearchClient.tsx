"use client";

import Link from "next/link";
import type { MeetingStatus as MeetingStatusValue } from "@prisma/client";
import { Calendar, FileText, Languages, Search } from "lucide-react";
import { useMemo, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingStatus } from "@/components/meeting/MeetingStatus";
import { highlightText } from "@/utils/highlight";

type SearchSnippet = {
  segmentId: string;
  sequence: number;
  originalText: string;
  translatedText: string | null;
};

type SearchResult = {
  meetingId: string;
  meetingTitle: string;
  meetingStatus: string;
  sourceLanguage: string;
  targetLanguage: string;
  createdAt: string;
  matchCount: number;
  snippets: SearchSnippet[];
};

type SearchPage = {
  items: SearchResult[];
  nextCursor: string | null;
  hasMore: boolean;
};

type SearchResponse = {
  data: SearchPage | null;
  error: { message: string } | null;
};

type AppliedFilters = {
  query: string;
  dateFrom: string;
  dateTo: string;
};

async function fetchSearch(url: string) {
  const response = await fetch(url);
  const payload = (await response.json()) as SearchResponse;

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "搜索失败");
  }

  return payload.data;
}

function buildSearchUrl(filters: AppliedFilters, cursor?: string | null) {
  const params = new URLSearchParams({
    q: filters.query,
    limit: "20",
  });

  if (filters.dateFrom) {
    params.set("dateFrom", `${filters.dateFrom}T00:00:00.000`);
  }

  if (filters.dateTo) {
    params.set("dateTo", `${filters.dateTo}T23:59:59.999`);
  }

  if (cursor) {
    params.set("cursor", cursor);
  }

  return `/api/search?${params.toString()}`;
}

function ResultSkeleton() {
  return (
    <div className="grid gap-3 rounded-md border bg-white p-4">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export function HistorySearchClient() {
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filters, setFilters] = useState<AppliedFilters | null>(null);
  const search = useSWRInfinite(
    (pageIndex, previousPageData: SearchPage | null) => {
      if (!filters?.query || (previousPageData && !previousPageData.hasMore)) {
        return null;
      }

      return buildSearchUrl(filters, pageIndex > 0 ? previousPageData?.nextCursor : null);
    },
    fetchSearch,
  );
  const results = useMemo(() => search.data?.flatMap((page) => page.items) ?? [], [search.data]);
  const lastPage = search.data?.at(-1);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();

    if (!normalized) {
      setFilters(null);
      return;
    }

    setFilters({
      query: normalized,
      dateFrom,
      dateTo,
    });
    void search.setSize(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">历史搜索</h1>
        <p className="text-sm text-muted-foreground">搜索会议字幕与译文，按匹配度排序。</p>
      </div>

      <form className="grid gap-3 rounded-md border bg-white p-4 md:grid-cols-[1fr_11rem_11rem_auto]" onSubmit={submit}>
        <div className="grid gap-2">
          <Label htmlFor="history-search">关键词</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="history-search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              className="pl-9"
              placeholder="搜索字幕、译文或会议标题"
              maxLength={100}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="history-date-from">开始日期</Label>
          <Input
            id="history-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.currentTarget.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="history-date-to">结束日期</Label>
          <Input
            id="history-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.currentTarget.value)}
          />
        </div>

        <Button type="submit" className="self-end">
          搜索
        </Button>
      </form>

      <div className="grid gap-3">
        {search.isLoading ? (
          <>
            <ResultSkeleton />
            <ResultSkeleton />
          </>
        ) : null}

        {results.map((result) => (
          <article key={result.meetingId} className="rounded-md border bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <MeetingStatus status={result.meetingStatus as MeetingStatusValue} />
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Languages className="size-3.5" />
                    {result.sourceLanguage} {"->"} {result.targetLanguage}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <FileText className="size-3.5" />
                    {result.matchCount} 个匹配片段
                  </span>
                </div>
                <Link href={`/meetings/${result.meetingId}`} className="block text-base font-semibold hover:underline">
                  {highlightText(result.meetingTitle, filters?.query ?? "")}
                </Link>
                <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="size-3.5" />
                  {new Date(result.createdAt).toLocaleString("zh-CN", { hour12: false })}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/meetings/${result.meetingId}`}>详情</Link>
              </Button>
            </div>

            <div className="mt-4 grid gap-2">
              {result.snippets.map((snippet) => (
                <div key={snippet.segmentId} className="rounded-md bg-slate-50 p-3 text-sm leading-6">
                  <p>
                    <span className="mr-2 text-xs text-muted-foreground">#{snippet.sequence}</span>
                    {highlightText(snippet.originalText, filters?.query ?? "")}
                  </p>
                  {snippet.translatedText ? (
                    <p className="mt-1 text-muted-foreground">
                      {highlightText(snippet.translatedText, filters?.query ?? "")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        ))}

        {filters && !search.isLoading && results.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">没有找到匹配的会议内容。</p>
            <Button asChild className="mt-4">
              <Link href="/meetings">查看会议列表</Link>
            </Button>
          </div>
        ) : null}

        {!filters ? (
          <div className="rounded-md border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">输入关键词后搜索历史字幕和译文。</p>
          </div>
        ) : null}
      </div>

      {lastPage?.hasMore ? (
        <Button type="button" variant="outline" onClick={() => void search.setSize((size) => size + 1)}>
          加载更多
        </Button>
      ) : null}
    </div>
  );
}
