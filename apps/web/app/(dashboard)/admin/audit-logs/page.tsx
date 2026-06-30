import { AdminAuditLogsClient } from "@/components/admin/AdminAuditLogsClient";
import { requireAdminAccess } from "@/lib/admin";

export default async function AdminAuditLogsPage() {
  await requireAdminAccess();
  return <AdminAuditLogsClient />;
}
