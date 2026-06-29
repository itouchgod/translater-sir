"use client";

import { Users } from "lucide-react";
import { useEffect, useState } from "react";
import type { MeetingStatus as MeetingStatusValue } from "@prisma/client";
import { MeetingStatus, formatMeetingDuration } from "@/components/meeting/MeetingStatus";

type MeetingHeaderProps = {
  title: string;
  status: MeetingStatusValue;
  startedAt: string | null;
  endedAt: string | null;
  onlineCount: number;
};

export function MeetingHeader({
  title,
  status,
  startedAt,
  endedAt,
  onlineCount,
}: MeetingHeaderProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (status !== "LIVE") {
      return;
    }

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [status]);

  return (
    <header className="flex flex-col gap-3 border-b bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <MeetingStatus status={status} />
          <span className="text-sm font-medium text-slate-600">
            {formatMeetingDuration(startedAt, endedAt ?? (status === "LIVE" ? new Date(now) : null))}
          </span>
        </div>
        <h1 className="truncate text-xl font-semibold text-slate-950">{title}</h1>
      </div>
      <div className="inline-flex items-center gap-2 text-sm text-slate-600">
        <Users className="size-4" />
        {onlineCount} 人在线
      </div>
    </header>
  );
}
