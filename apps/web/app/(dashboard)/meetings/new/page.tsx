import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MeetingForm } from "@/components/meeting/MeetingForm";

export default function NewMeetingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-normal">新建会议</h1>
        <p className="text-sm text-muted-foreground">设置标题和语言对，创建后即可开始实时传译。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>会议配置</CardTitle>
          <CardDescription>会议创建后仍可在详情页修改标题和语言对。</CardDescription>
        </CardHeader>
        <CardContent>
          <MeetingForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
