import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InvitationAcceptForm } from "@/components/org/InvitationAcceptForm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { peekInvitationToken } from "@/lib/organizations";

type InvitationPageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitationPage({ params }: InvitationPageProps) {
  const [{ token }, session] = await Promise.all([params, auth()]);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const invitation = await peekInvitationToken(token);

  if (!invitation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>邀请已失效</CardTitle>
          <CardDescription>邀请链接不存在、已被使用或已超过 24 小时。</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const [organization, user] = await Promise.all([
    db.organization.findUnique({
      where: { id: invitation.orgId },
      select: { name: true },
    }),
    db.user.findFirst({
      where: {
        id: session.user.id,
        deletedAt: null,
      },
      select: {
        email: true,
      },
    }),
  ]);

  if (!organization || !user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>邀请不可用</CardTitle>
          <CardDescription>对应组织不存在，或当前账号不可用。</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const emailMatches = user.email.toLowerCase() === invitation.email.toLowerCase();

  return (
    <Card>
      <CardHeader>
        <CardTitle>加入 {organization.name}</CardTitle>
        <CardDescription>
          此邀请发送给 {invitation.email}，角色为 {invitation.role}，24 小时内有效。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {emailMatches ? (
          <InvitationAcceptForm token={token} />
        ) : (
          <p className="text-sm text-muted-foreground">
            当前登录邮箱为 {user.email}，请切换到被邀请邮箱后再接受邀请。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
