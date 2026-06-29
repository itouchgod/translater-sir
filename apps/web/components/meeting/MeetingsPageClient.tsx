"use client";

import Link from "next/link";
import type { MeetingStatus as MeetingStatusValue } from "@prisma/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MeetingCard } from "@/components/meeting/MeetingCard";
import { useMeetings } from "@/hooks/useMeetings";

export function MeetingsPageClient() {
  const [status, setStatus] = useState<MeetingStatusValue | "ALL">("ALL");
  const meetings = useMeetings({ status });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">会议</h1>
          <p className="text-sm text-muted-foreground">创建、开始、结束和回看实时传译会议。</p>
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={(value) => setStatus(value as MeetingStatusValue | "ALL")}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部状态</SelectItem>
              <SelectItem value="SCHEDULED">未开始</SelectItem>
              <SelectItem value="LIVE">进行中</SelectItem>
              <SelectItem value="PROCESSING">处理中</SelectItem>
              <SelectItem value="COMPLETED">已完成</SelectItem>
              <SelectItem value="FAILED">失败</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild>
            <Link href="/meetings/new">新建会议</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {meetings.meetings.map((meeting) => (
          <MeetingCard key={meeting.id} meeting={meeting} onDeleted={() => void meetings.mutate()} />
        ))}
      </div>

      {!meetings.isLoading && meetings.meetings.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-slate-500">暂无会议</p>
          <Button asChild className="mt-4">
            <Link href="/meetings/new">创建你的第一个会议</Link>
          </Button>
        </div>
      ) : null}

      {meetings.hasMore ? (
        <Button type="button" variant="outline" onClick={() => void meetings.loadMore()}>
          加载更多
        </Button>
      ) : null}
    </div>
  );
}
