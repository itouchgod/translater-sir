"use client";

import { Download, Search, Trash2 } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import { ImportButton } from "@/components/dictionary/ImportButton";
import { TermForm } from "@/components/dictionary/TermForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDictionaryTerms, type DictionaryTermItem } from "@/hooks/useDictionaryTerms";

type TermListProps = {
  dictionaryId: string;
};

type DeleteResponse = {
  data: { deleted: boolean } | null;
  error: { message: string } | null;
};

function matchesTerm(term: DictionaryTermItem, query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return (
    term.source.toLowerCase().includes(normalized) ||
    term.target.toLowerCase().includes(normalized) ||
    term.language.toLowerCase().includes(normalized) ||
    (term.notes?.toLowerCase().includes(normalized) ?? false)
  );
}

export function TermList({ dictionaryId }: TermListProps) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const initialTerms = useDictionaryTerms(dictionaryId, { limit: 501 });
  const usesServerSearch = initialTerms.totalTerms > 500;
  const serverTerms = useDictionaryTerms(dictionaryId, {
    query: usesServerSearch ? deferredSearch : undefined,
    limit: 50,
    enabled: usesServerSearch,
  });
  const activeTerms = usesServerSearch ? serverTerms : initialTerms;
  const visibleTerms = useMemo(() => {
    if (usesServerSearch) {
      return activeTerms.terms;
    }

    return activeTerms.terms.filter((term) => matchesTerm(term, deferredSearch));
  }, [activeTerms.terms, deferredSearch, usesServerSearch]);

  async function refreshTerms() {
    await Promise.all([initialTerms.mutate(), serverTerms.mutate()]);
  }

  async function deleteTerm(termId: string) {
    if (!window.confirm("确定删除这个术语吗？")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/dictionaries/${encodeURIComponent(dictionaryId)}/terms/${encodeURIComponent(termId)}`,
        {
          method: "DELETE",
        },
      );
      const payload = (await response.json()) as DeleteResponse;

      if (!response.ok || payload.error || !payload.data?.deleted) {
        throw new Error(payload.error?.message ?? "删除术语失败");
      }

      toast.success("术语已删除");
      await refreshTerms();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除术语失败");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-2 lg:w-80">
          <label className="text-sm font-medium" htmlFor="term-search">
            搜索术语
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="term-search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              className="pl-9"
              placeholder={usesServerSearch ? "服务端搜索" : "本地搜索"}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <TermForm dictionaryId={dictionaryId} onSaved={() => void refreshTerms()} />
          <ImportButton dictionaryId={dictionaryId} onImported={() => void refreshTerms()} />
          <Button asChild variant="outline">
            <a href={`/api/dictionaries/${encodeURIComponent(dictionaryId)}/export`}>
              <Download className="size-4" />
              导出 CSV
            </a>
          </Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        {usesServerSearch
          ? `共 ${activeTerms.totalTerms} 条，当前筛选 ${activeTerms.totalCount} 条`
          : `共 ${activeTerms.totalTerms} 条，当前显示 ${visibleTerms.length} 条`}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>原文</TableHead>
            <TableHead>译文</TableHead>
            <TableHead>语言对</TableHead>
            <TableHead>备注</TableHead>
            <TableHead className="w-32 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleTerms.map((term) => (
            <TableRow key={term.id}>
              <TableCell className="max-w-48 whitespace-normal font-medium">{term.source}</TableCell>
              <TableCell className="max-w-48 whitespace-normal">{term.target}</TableCell>
              <TableCell>{term.language}</TableCell>
              <TableCell className="max-w-64 whitespace-normal text-muted-foreground">
                {term.notes || "-"}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <TermForm dictionaryId={dictionaryId} term={term} onSaved={() => void refreshTerms()} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void deleteTerm(term.id)}
                  >
                    <Trash2 className="size-4" />
                    删除
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {!activeTerms.isLoading && visibleTerms.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          暂无术语
        </div>
      ) : null}

      {usesServerSearch && activeTerms.hasMore ? (
        <Button type="button" variant="outline" onClick={() => void activeTerms.loadMore()}>
          加载更多
        </Button>
      ) : null}
    </div>
  );
}
