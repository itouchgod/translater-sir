import "server-only";

import type { ApiKey, Organization } from "@prisma/client";
import { db } from "@/lib/db";
import { hashApiKey, normalizeApiKeyScopes, type ApiKeyScope } from "@/lib/api-key";
import { logger } from "@/lib/logger";

export type ApiKeyAuthContext = {
  org: Organization;
  scopes: ApiKeyScope[];
  apiKey: Pick<ApiKey, "id" | "name" | "keyPrefix" | "userId" | "organizationId">;
};

function extractBearerToken(request: Request) {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function getRequestAuditContext(request: Request) {
  return {
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  };
}

function recordApiKeyUsage(request: Request, apiKey: ApiKey) {
  const auditContext = getRequestAuditContext(request);

  void Promise.all([
    db.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }),
    db.auditLog.create({
      data: {
        userId: apiKey.userId,
        action: "apikey.use",
        resource: "ApiKey",
        resourceId: apiKey.id,
        ip: auditContext.ip,
        userAgent: auditContext.userAgent,
        metadata: {
          organizationId: apiKey.organizationId,
          keyPrefix: apiKey.keyPrefix,
        },
      },
    }),
  ]).catch((error) => {
    logger.warn({ error, apiKeyId: apiKey.id }, "Failed to record API key usage");
  });
}

export async function authenticateApiKey(request: Request): Promise<ApiKeyAuthContext | null> {
  const key = extractBearerToken(request);

  if (!key) {
    return null;
  }

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash: hashApiKey(key) },
    include: {
      organization: true,
    },
  });

  if (!apiKey) {
    return null;
  }

  if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) {
    return null;
  }

  recordApiKeyUsage(request, apiKey);

  return {
    org: apiKey.organization,
    scopes: normalizeApiKeyScopes(apiKey.scopes),
    apiKey: {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      userId: apiKey.userId,
      organizationId: apiKey.organizationId,
    },
  };
}
