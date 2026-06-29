import { AdminLogsClient } from "@/components/admin/AdminLogsClient";
import { requireAdminAccess } from "@/lib/admin";

export default async function AdminLogsPage() {
  await requireAdminAccess();
  return <AdminLogsClient />;
}
