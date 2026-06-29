import { AdminOverviewClient } from "@/components/admin/AdminOverviewClient";
import { requireAdminAccess } from "@/lib/admin";

export default async function AdminPage() {
  await requireAdminAccess();
  return <AdminOverviewClient />;
}
