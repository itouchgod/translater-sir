import type { MeetingStatus as MeetingStatusValue } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type MeetingStatusProps = {
  status: MeetingStatusValue;
};

const statusLabel: Record<MeetingStatusValue, string> = {
  SCHEDULED: "未开始",
  LIVE: "进行中",
  PROCESSING: "处理中",
  COMPLETED: "已完成",
  FAILED: "失败",
};

export function MeetingStatus({ status }: MeetingStatusProps) {
  return (
    <Badge
      variant={status === "FAILED" ? "destructive" : status === "LIVE" ? "default" : "secondary"}
      className={cn(status === "LIVE" && "gap-1.5")}
    >
      {status === "LIVE" ? (
        <span className="size-2 rounded-full bg-red-500 motion-safe:animate-pulse" />
      ) : null}
      {statusLabel[status]}
    </Badge>
  );
}

export function formatMeetingDuration(startedAt?: string | Date | null, endedAt?: string | Date | null) {
  if (!startedAt) {
    return "00:00:00";
  }

  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}
