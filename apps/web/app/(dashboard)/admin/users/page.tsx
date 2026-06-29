import { AdminUsersClient } from "@/components/admin/AdminUsersClient";
import { requireAdminAccess } from "@/lib/admin";

export default async function AdminUsersPage() {
  await requireAdminAccess();
  return <AdminUsersClient />;
}
