import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InviteForm } from "@/components/org/InviteForm";
import { MemberList, type OrganizationMember } from "@/components/org/MemberList";
import { auth } from "@/lib/auth";
import { requireCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { canManageMembers } from "@/lib/organizations";

const MEMBERS_PAGE_SIZE = 20;

export default async function MembersSettingsPage() {
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
          <h1 className="text-2xl font-semibold tracking-normal">团队成员</h1>
          <p className="text-sm text-muted-foreground">当前账号尚未加入任何组织。</p>
        </div>
      </div>
    );
  }

  const members = await db.member.findMany({
    where: {
      organizationId: activeMembership.organization.id,
      user: {
        deletedAt: null,
      },
    },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    take: MEMBERS_PAGE_SIZE + 1,
    select: {
      id: true,
      role: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });
  const hasMore = members.length > MEMBERS_PAGE_SIZE;
  const visibleMembers = hasMore ? members.slice(0, MEMBERS_PAGE_SIZE) : members;
  const canManage = canManageMembers(activeMembership.role);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">团队成员</h1>
        <p className="text-sm text-muted-foreground">
          管理 {activeMembership.organization.name} 的成员、邀请和角色。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>邀请成员</CardTitle>
          <CardDescription>邀请链接会发送到成员邮箱，并在 24 小时后失效。</CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm organizationId={activeMembership.organization.id} canManage={canManage} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>成员列表</CardTitle>
          <CardDescription>OWNER 不能在此处被降级或移除。</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberList
            organizationId={activeMembership.organization.id}
            currentUserId={user.id}
            canManage={canManage}
            initialMembers={visibleMembers satisfies OrganizationMember[]}
            initialPageInfo={{
              hasMore,
              nextCursor: hasMore ? visibleMembers.at(-1)?.id ?? null : null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
