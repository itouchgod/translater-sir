import { ApiKeysPageClient } from "@/components/api-keys/ApiKeysPageClient";
import { requireAuth, requirePermission } from "@/lib/auth-helpers";
import { ValidationError } from "@/lib/errors";

export default async function ApiKeysPage() {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    throw new ValidationError("请先加入或创建组织");
  }

  await requirePermission(organizationId, "apikey:manage");

  return <ApiKeysPageClient />;
}
