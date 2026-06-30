import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { DashboardNav } from "@/components/layout/DashboardNav";
import { OrgSwitcher } from "@/components/org/OrgSwitcher";
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
  const canAccessAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
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
          <DashboardNav
            canViewBilling={canViewBilling}
            canManageApiKeys={canManageApiKeys}
            canManageWebhooks={canManageWebhooks}
            canAccessAdmin={canAccessAdmin}
            user={{
              name: user.name,
              email: user.email,
              avatarUrl: user.avatarUrl,
            }}
          />
        </header>
        {children}
      </div>
    </main>
  );
}
