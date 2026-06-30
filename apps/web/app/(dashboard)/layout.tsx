import { redirect } from "next/navigation";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { OrgSwitcher } from "@/components/org/OrgSwitcher";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { requireCurrentUser } from "@/lib/current-user";
import { can } from "@/utils/permissions";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, user] = await Promise.all([auth(), requireCurrentUser()]);

  if (!session?.user?.id || !user) {
    redirect("/login");
  }

  const activeMembership =
    user.memberships.find((membership) => membership.organization.id === session.user.organizationId) ??
    user.memberships[0] ??
    null;
  const activeOrganizationId = activeMembership?.organization.id ?? null;
  const canViewBilling = activeMembership ? can(activeMembership.role, "billing:view") : false;
  const canManageApiKeys = activeMembership ? can(activeMembership.role, "apikey:manage") : false;
  const canManageWebhooks = activeMembership ? can(activeMembership.role, "webhook:manage") : false;
  const organizations = user.memberships.map((membership) => ({
    id: membership.organization.id,
    name: membership.organization.name,
    slug: membership.organization.slug,
  }));

  return (
    <main className="min-h-svh bg-background px-4 py-8 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
          <OrgSwitcher
            organizations={organizations}
            activeOrganizationId={activeOrganizationId}
          />
          <nav className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/meetings">会议</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/history">历史</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dictionary">词典</Link>
            </Button>
            {canViewBilling ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/billing">计费</Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <Link href="/settings/profile">个人资料</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/settings/organization">组织</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/settings/members">成员</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/settings/security">安全</Link>
            </Button>
            {canManageApiKeys ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/settings/api-keys">API Key</Link>
              </Button>
            ) : null}
            {canManageWebhooks ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/settings/webhooks">Webhooks</Link>
              </Button>
            ) : null}
            {user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin">管理</Link>
              </Button>
            ) : null}
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
