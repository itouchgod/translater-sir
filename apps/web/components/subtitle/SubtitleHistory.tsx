"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSubtitleStore } from "@/stores/subtitle.store";
import type { Subtitle } from "@/types/subtitle";
import { cn } from "@/lib/utils";

type SubtitleHistoryProps = {
  meetingId: string;
  className?: string;
  onSelectSubtitle?: (subtitle: Subtitle) => void;
};

type SegmentsResponse = {
  data: {
    items: Subtitle[];
    nextCursor: number | null;
    hasMore: boolean;
  } | null;
  error: { message: string } | null;
};

export function SubtitleHistory({
  meetingId,
  className,
  onSelectSubtitle,
}: SubtitleHistoryProps) {
  const [items, setItems] = useState<Subtitle[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hydrateSubtitles = useSubtitleStore((state) => state.hydrateSubtitles);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    if (!keyword) {
      return items;
    }

    return items.filter((item) => {
      const translation = item.translation ?? "";
      return (
        item.text.toLowerCase().includes(keyword) ||
        translation.toLowerCase().includes(keyword)
      );
    });
  }, [items, query]);

  async function loadMore() {
    if (isLoading || !hasMore) {
      return;
    }

    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        limit: "50",
      });

      if (cursor !== null) {
        params.set("cursor", String(cursor));
      }

      const response = await fetch(
        `/api/meetings/${encodeURIComponent(meetingId)}/segments?${params.toString()}`,
      );
      const payload = (await response.json()) as SegmentsResponse;

      if (!response.ok || !payload.data) {
        return;
      }

      const data = payload.data;
      setItems((previous) => {
        const byId = new Map(previous.map((item) => [item.id, item]));

        for (const item of data.items) {
          byId.set(item.id, item);
        }

        return [...byId.values()].toSorted((left, right) => left.sequence - right.sequence);
      });
      hydrateSubtitles(data.items);
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className={cn("space-y-3", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
          }}
          placeholder="搜索字幕"
          className="pl-9"
        />
      </div>

      <div className="max-h-96 overflow-y-auto rounded-md border">
        {filteredItems.map((subtitle) => (
          <button
            key={subtitle.id}
            type="button"
            onClick={() => {
              setSelectedId(subtitle.id);
              onSelectSubtitle?.(subtitle);
            }}
            className={cn(
              "block w-full border-b px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-slate-50",
              selectedId === subtitle.id && "bg-blue-50",
            )}
          >
            <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>#{subtitle.sequence}</span>
              <span>{new Date(subtitle.timestamp).toLocaleTimeString()}</span>
            </div>
            <p className="mt-1 text-sm text-slate-900">{subtitle.text}</p>
            {subtitle.translation ? (
              <p className="mt-1 text-sm text-slate-600">{subtitle.translation}</p>
            ) : null}
          </button>
        ))}

        {filteredItems.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-slate-500">暂无字幕</div>
        ) : null}
      </div>

      <Button type="button" variant="outline" onClick={loadMore} disabled={isLoading || !hasMore}>
        {hasMore ? (isLoading ? "加载中" : "加载更多") : "已加载全部"}
      </Button>
    </section>
  );
}
