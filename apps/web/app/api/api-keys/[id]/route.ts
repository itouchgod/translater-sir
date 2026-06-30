import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { ApiKeyScopeSchema } from "@/lib/api-key";
import { getRequestAuditContext } from "@/lib/admin";
import { requireAuth, requirePermission } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";

const UpdateApiKeySchema = z.object({
  name: z.string().trim().min(1, "名称不能为空").max(80, "名称不能超过 80 个字符").optional(),
  scopes: z.array(ApiKeyScopeSchema).min(1, "至少选择一个权限范围").optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseExpiresAt(value?: string | null) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  const expiresAt = new Date(value);
  if (expiresAt <= new Date()) {
    throw new ValidationError("到期时间必须晚于当前时间");
  }

  return expiresAt;
}

async function getAccessibleApiKey(id: string, organizationId: string) {
  const apiKey = await db.apiKey.findFirst({
    where: {
      id,
      organizationId,
    },
    select: {
      id: true,
      keyPrefix: true,
      scopes: true,
    },
  });

  if (!apiKey) {
    throw new NotFoundError("API Key 不存在");
  }

  return apiKey;
}

export const runtime = "nodejs";

export const PATCH = withApiHandler(async function PATCH(request: Request, context: RouteContext) {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;
  const { id } = await context.params;

  if (!organizationId) {
    throw new ValidationError("请先加入或创建组织");
  }

  await requirePermission(organizationId, "apikey:manage");
  const existing = await getAccessibleApiKey(id, organizationId);
  const parsed = UpdateApiKeySchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "API Key 信息无效");
  }

  const expiresAt = parseExpiresAt(parsed.data.expiresAt);
  const auditContext = getRequestAuditContext(request);

  const apiKey = await db.$transaction(async (tx) => {
    const updated = await tx.apiKey.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.scopes !== undefined ? { scopes: parsed.data.scopes } : {}),
        ...(expiresAt !== undefined ? { expiresAt } : {}),
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "apikey.update",
        resource: "ApiKey",
        resourceId: updated.id,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        metadata: {
          organizationId,
          keyPrefix: existing.keyPrefix,
          previousScopes: existing.scopes,
          scopes: updated.scopes,
        },
      },
    });

    return updated;
  });

  return apiSuccess(apiKey);
});

export const DELETE = withApiHandler(async function DELETE(request: Request, context: RouteContext) {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;
  const { id } = await context.params;

  if (!organizationId) {
    throw new ValidationError("请先加入或创建组织");
  }

  await requirePermission(organizationId, "apikey:manage");
  const existing = await getAccessibleApiKey(id, organizationId);
  const auditContext = getRequestAuditContext(request);

  await db.$transaction([
    db.apiKey.delete({
      where: { id },
    }),
    db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "apikey.delete",
        resource: "ApiKey",
        resourceId: id,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        metadata: {
          organizationId,
          keyPrefix: existing.keyPrefix,
          scopes: existing.scopes,
        },
      },
    }),
  ]);

  return apiSuccess({ deleted: true });
});
