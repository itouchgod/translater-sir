"use client";

import { Download, FileText, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import type { MeetingSummary } from "@/lib/summary/types";

type SummaryResponse = {
  data: {
    status: "empty" | "ready";
    summary: MeetingSummary | null;
    summaryUrl: string | null;
  } | null;
  error: { message: string } | null;
};

type GenerateResponse = {
  data: {
    status: "processing" | "ready";
    summary?: MeetingSummary;
  } | null;
  error: { message: string } | null;
};

type SummaryPanelProps = {
  meetingId: string;
};

async function fetchSummary(url: string) {
  const response = await fetch(url);
  const payload = (await response.json()) as SummaryResponse;

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "获取会议纪要失败");
  }

  return payload.data;
}

export function SummaryPanel({ meetingId }: SummaryPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const summary = useSWR(
    `/api/meetings/${encodeURIComponent(meetingId)}/summary`,
    fetchSummary,
    {
      refreshInterval: () => (isGenerating ? 3000 : 0),
      onSuccess: (data) => {
        if (data.summary) {
          setIsGenerating(false);
        }
      },
    },
  );
  const data = summary.data;

  async function generate(force = false) {
    setIsGenerating(true);

    try {
      const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/summary/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force }),
      });
      const payload = (await response.json()) as GenerateResponse;

      if (!response.ok || payload.error || !payload.data) {
        throw new Error(payload.error?.message ?? "生成会议纪要失败");
      }

      if (payload.data.status === "ready") {
        setIsGenerating(false);
      }

      toast.success(payload.data.status === "ready" ? "会议纪要已存在" : "会议纪要生成中");
      await summary.mutate();
    } catch (error) {
      setIsGenerating(false);
      toast.error(error instanceof Error ? error.message : "生成会议纪要失败");
    }
  }

  if (!data?.summary) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">暂无会议纪要。</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void generate(false)} disabled={isGenerating}>
            <Sparkles className="size-4" />
            {isGenerating ? "生成中" : "生成纪要"}
          </Button>
          {isGenerating ? (
            <Button type="button" variant="outline" onClick={() => void summary.mutate()}>
              <RefreshCw className="size-4" />
              刷新状态
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-muted-foreground" />
            <h3 className="font-semibold">{data.summary.title}</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.summary.date} · {data.summary.duration}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void generate(true)} disabled={isGenerating}>
            <RefreshCw className="size-4" />
            重新生成
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/meetings/${encodeURIComponent(meetingId)}/export/pdf`}>
              <Download className="size-4" />
              PDF
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/meetings/${encodeURIComponent(meetingId)}/export/docx`}>
              <Download className="size-4" />
              DOCX
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/meetings/${encodeURIComponent(meetingId)}/export/txt`}>
              <Download className="size-4" />
              TXT
            </a>
          </Button>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold">概览</h4>
        <p className="text-sm leading-6 text-muted-foreground">{data.summary.overview}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="grid content-start gap-2">
          <h4 className="text-sm font-semibold">要点</h4>
          {data.summary.keyPoints.map((item) => (
            <p key={item} className="rounded-md border p-3 text-sm">
              {item}
            </p>
          ))}
        </section>

        <section className="grid content-start gap-2">
          <h4 className="text-sm font-semibold">决策</h4>
          {data.summary.decisions.length > 0 ? (
            data.summary.decisions.map((item) => (
              <p key={item} className="rounded-md border p-3 text-sm">
                {item}
              </p>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">无</p>
          )}
        </section>

        <section className="grid content-start gap-2">
          <h4 className="text-sm font-semibold">待办</h4>
          {data.summary.actionItems.length > 0 ? (
            data.summary.actionItems.map((item) => (
              <div key={`${item.task}-${item.owner ?? ""}`} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{item.task}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.owner ? `负责人：${item.owner}` : "未指定负责人"}
                  {item.deadline ? ` · 截止：${item.deadline}` : ""}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">无</p>
          )}
        </section>
      </div>
    </div>
  );
}
