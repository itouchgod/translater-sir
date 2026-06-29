"use client";

import Link from "next/link";
import { Calendar, FileText, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeetingStatus } from "@/components/meeting/MeetingStatus";
import type { DashboardStats } from "@/lib/dashboard";
import type { MeetingStatus as MeetingStatusValue } from "@prisma/client";

type RecentMeetingsProps = {
  meetings: DashboardStats["recentMeetings"];
};

export function RecentMeetings({ meetings }: RecentMeetingsProps) {
  if (meetings.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">还没有会议数据。</p>
        <Button asChild className="mt-4">
          <Link href="/meetings/new">创建你的第一个会议</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {meetings.map((meeting) => (
        <article key={meeting.id} className="rounded-md border bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <MeetingStatus status={meeting.status as MeetingStatusValue} />
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Languages className="size-3.5" />
                  {meeting.sourceLanguage} {"->"} {meeting.targetLanguage}
                </span>
              </div>
              <Link href={`/meetings/${meeting.id}`} className="block font-semibold hover:underline">
                {meeting.title}
              </Link>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  {new Date(meeting.createdAt).toLocaleString("zh-CN", { hour12: false })}
                </span>
                <span className="inline-flex items-center gap-1">
                  <FileText className="size-3.5" />
                  {meeting._count.segments} 条字幕 / {meeting._count.files} 个文件
                </span>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/meetings/${meeting.id}`}>详情</Link>
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
