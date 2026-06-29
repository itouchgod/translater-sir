import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AvatarUpload } from "@/components/user/AvatarUpload";
import { ProfileForm } from "@/components/user/ProfileForm";
import { requireCurrentUser } from "@/lib/current-user";

export default async function ProfileSettingsPage() {
  const user = await requireCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">个人资料</h1>
        <p className="text-sm text-muted-foreground">管理你的头像、姓名和登录邮箱。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>头像</CardTitle>
          <CardDescription>头像会显示在会议、团队成员和导出记录中。</CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUpload
            userId={user.id}
            name={user.name}
            email={user.email}
            avatarUrl={user.avatarUrl}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
          <CardDescription>邮箱当前只读，姓名可随时更新。</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm name={user.name} email={user.email} />
        </CardContent>
      </Card>
    </div>
  );
}
