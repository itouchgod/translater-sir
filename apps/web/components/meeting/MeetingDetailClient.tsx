"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MeetingForm } from "@/components/meeting/MeetingForm";
import { MeetingStatus, formatMeetingDuration } from "@/components/meeting/MeetingStatus";
import { SubtitleHistory } from "@/components/subtitle/SubtitleHistory";
import { useMeeting, type MeetingDetail } from "@/hooks/useMeeting";

type MeetingDetailClientProps = {
  meetingId: string;
  initialMeeting: MeetingDetail;
};

async function postMeetingAction(meetingId: string, action: "start" | "end") {
  const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/${action}`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("会议状态更新失败");
  }
}

export function MeetingDetailClient({ meetingId, initialMeeting }: MeetingDetailClientProps) {
  const router = useRouter();
  const meeting = useMeeting(meetingId);
  const data = meeting.data ?? initialMeeting;

  async function startMeeting() {
    await postMeetingAction(data.id, "start");
    await meeting.mutate();
    router.push(`/meetings/${data.id}/live`);
  }

  async function endMeeting() {
    await postMeetingAction(data.id, "end");
    await meeting.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <MeetingStatus status={data.status} />
            <span className="text-sm text-slate-500">
              {data.sourceLanguage} {"->"} {data.targetLanguage}
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-normal">{data.title}</h1>
          <p className="text-sm text-muted-foreground">
            创建于 {new Date(data.createdAt).toLocaleString("zh-CN", { hour12: false })}，时长{" "}
            {formatMeetingDuration(data.startedAt, data.endedAt)}
          </p>
        </div>
        <div className="flex gap-2">
          {data.status === "SCHEDULED" ? (
            <Button type="button" onClick={() => void startMeeting()}>
              开始会议
            </Button>
          ) : null}
          {data.status === "LIVE" ? (
            <>
              <Button asChild>
                <Link href={`/meetings/${data.id}/live`}>进入会议室</Link>
              </Button>
              <Button type="button" variant="destructive" onClick={() => void endMeeting()}>
                结束会议
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>会议信息</CardTitle>
          <CardDescription>可更新标题和语言对。</CardDescription>
        </CardHeader>
        <CardContent>
          <MeetingForm
            mode="edit"
            meetingId={data.id}
            initialValues={{
              title: data.title,
              sourceLanguage: data.sourceLanguage,
              targetLanguage: data.targetLanguage,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>字幕历史</CardTitle>
          <CardDescription>{data._count.segments} 条字幕，按时间顺序懒加载。</CardDescription>
        </CardHeader>
        <CardContent>
          <SubtitleHistory meetingId={data.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>文件</CardTitle>
          <CardDescription>{data._count.files} 个会议文件。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {data.files.map((file) => (
              <div key={file.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {file.type} · {(file.sizeBytes / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/download/${file.id}`}>下载</a>
                </Button>
              </div>
            ))}
            {data.files.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无文件</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
