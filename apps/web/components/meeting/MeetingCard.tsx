"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Clock, FileText, Languages, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MeetingStatus, formatMeetingDuration } from "@/components/meeting/MeetingStatus";
import type { MeetingListItem } from "@/hooks/useMeetings";

type MeetingCardProps = {
  meeting: MeetingListItem;
  onDeleted?: () => void;
};

export function MeetingCard({ meeting, onDeleted }: MeetingCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function deleteMeeting() {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/meetings/${encodeURIComponent(meeting.id)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        return;
      }

      setOpen(false);
      onDeleted?.();
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <article className="rounded-md border bg-white p-4 shadow-sm transition-colors hover:bg-slate-50">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <MeetingStatus status={meeting.status} />
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Languages className="size-3.5" />
              {meeting.sourceLanguage} {"->"} {meeting.targetLanguage}
            </span>
          </div>
          <div>
            <Link
              href={`/meetings/${meeting.id}`}
              className="text-base font-semibold text-slate-950 hover:underline"
            >
              {meeting.title}
            </Link>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5" />
                {new Date(meeting.createdAt).toLocaleString("zh-CN", { hour12: false })}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" />
                {formatMeetingDuration(meeting.startedAt, meeting.endedAt)}
              </span>
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3.5" />
                {meeting._count.segments} 条字幕 / {meeting._count.files} 个文件
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {meeting.status === "LIVE" ? (
            <Button asChild size="sm">
              <Link href={`/meetings/${meeting.id}/live`}>进入</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href={`/meetings/${meeting.id}`}>详情</Link>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="destructive" size="icon-sm" aria-label="删除会议">
                <Trash2 />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>删除会议</DialogTitle>
                <DialogDescription>
                  此操作会删除会议记录、字幕和关联文件，R2 文件也会同步删除。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  取消
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={() => void deleteMeeting()}
                >
                  {isDeleting ? "删除中" : "确认删除"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </article>
  );
}
