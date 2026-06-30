import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export type AuditParams = {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonObject;
  request?: Request;
};

export function getAuditRequestContext(request: Request | undefined) {
  return {
    ip: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request?.headers.get("user-agent") ?? null,
  };
}

export async function auditLog(params: AuditParams): Promise<void> {
  const context = getAuditRequestContext(params.request);

  void db.auditLog
    .create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId ?? null,
        metadata: params.metadata,
        ip: context.ip,
        userAgent: context.userAgent,
      },
    })
    .catch((error) => {
      logger.error({ error, action: params.action, resource: params.resource }, "Failed to write audit log");
    });
}
