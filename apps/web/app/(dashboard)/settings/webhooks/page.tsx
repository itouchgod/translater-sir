import { WebhooksPageClient } from "@/components/webhooks/WebhooksPageClient";
import { requireAuth, requirePermission } from "@/lib/auth-helpers";
import { ValidationError } from "@/lib/errors";

export default async function WebhooksPage() {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    throw new ValidationError("请先加入或创建组织");
  }

  await requirePermission(organizationId, "webhook:manage");

  return <WebhooksPageClient />;
}
