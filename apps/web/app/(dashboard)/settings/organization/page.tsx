import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrganizationSettingsForm } from "@/components/org/OrganizationSettingsForm";
import { auth } from "@/lib/auth";
import { requireCurrentUser } from "@/lib/current-user";
import { canManageMembers } from "@/lib/organizations";

export default async function OrganizationSettingsPage() {
  const [session, user] = await Promise.all([auth(), requireCurrentUser()]);

  if (!session?.user?.id || !user) {
    redirect("/login");
  }

  const activeMembership =
    user.memberships.find((membership) => membership.organization.id === session.user.organizationId) ??
    user.memberships[0];

  if (!activeMembership) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-normal">组织设置</h1>
          <p className="text-sm text-muted-foreground">当前账号尚未加入任何组织。</p>
        </div>
      </div>
    );
  }

  const canManage = canManageMembers(activeMembership.role);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">组织设置</h1>
        <p className="text-sm text-muted-foreground">管理当前组织的名称和 Logo。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
          <CardDescription>
            只有 OWNER 或 ADMIN 可以修改组织信息，Logo 会上传到 R2 并保存公开 URL。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationSettingsForm
            organization={activeMembership.organization}
            canManage={canManage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
