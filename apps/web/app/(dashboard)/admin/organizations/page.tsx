import { AdminOrganizationsClient } from "@/components/admin/AdminOrganizationsClient";
import { requireAdminAccess } from "@/lib/admin";

export default async function AdminOrganizationsPage() {
  await requireAdminAccess();
  return <AdminOrganizationsClient />;
}
