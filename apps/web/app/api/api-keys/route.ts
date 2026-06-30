import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { ApiKeyScopeSchema, generateApiKey } from "@/lib/api-key";
import { getRequestAuditContext } from "@/lib/admin";
import { requireAuth, requirePermission } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";

const CreateApiKeySchema = z.object({
  name: z.string().trim().min(1, "名称不能为空").max(80, "名称不能超过 80 个字符"),
  scopes: z.array(ApiKeyScopeSchema).min(1, "至少选择一个权限范围"),
  expiresAt: z.string().datetime().nullable().optional(),
});

function parseExpiresAt(value?: string | null) {
  if (!value) {
    return null;
  }

  const expiresAt = new Date(value);
  if (expiresAt <= new Date()) {
    throw new ValidationError("到期时间必须晚于当前时间");
  }

  return expiresAt;
}

export const runtime = "nodejs";

export const GET = withApiHandler(async function GET() {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    throw new ValidationError("请先加入或创建组织");
  }

  await requirePermission(organizationId, "apikey:manage");

  const apiKeys = await db.apiKey.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return apiSuccess({ items: apiKeys });
});

export const POST = withApiHandler(async function POST(request: Request) {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    throw new ValidationError("请先加入或创建组织");
  }

  await requirePermission(organizationId, "apikey:manage");

  const parsed = CreateApiKeySchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "API Key 信息无效");
  }

  const generated = generateApiKey();
  const expiresAt = parseExpiresAt(parsed.data.expiresAt);
  const auditContext = getRequestAuditContext(request);

  const apiKey = await db.$transaction(async (tx) => {
    const created = await tx.apiKey.create({
      data: {
        organizationId,
        userId: session.user.id,
        name: parsed.data.name,
        keyHash: generated.hash,
        keyPrefix: generated.prefix,
        scopes: parsed.data.scopes,
        expiresAt,
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
        action: "apikey.create",
        resource: "ApiKey",
        resourceId: created.id,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        metadata: {
          organizationId,
          keyPrefix: created.keyPrefix,
          scopes: created.scopes,
        },
      },
    });

    return created;
  });

  return apiSuccess(
    {
      apiKey,
      key: generated.key,
    },
    { status: 201 },
  );
});
