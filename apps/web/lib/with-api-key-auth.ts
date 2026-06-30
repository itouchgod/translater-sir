import "server-only";

import { apiError } from "@/lib/api-response";
import { authenticateApiKey, type ApiKeyAuthContext } from "@/lib/api-auth";
import type { ApiKeyScope } from "@/lib/api-key";

type ApiKeyHandler<TArgs extends readonly unknown[]> = (
  request: Request,
  context: ApiKeyAuthContext,
  ...args: TArgs
) => Response | Promise<Response>;

export function withApiKeyAuth<TArgs extends readonly unknown[]>(
  requiredScope: ApiKeyScope,
  handler: ApiKeyHandler<TArgs>,
) {
  return async (request: Request, ...args: TArgs) => {
    const context = await authenticateApiKey(request);

    if (!context) {
      return apiError("UNAUTHORIZED", "API Key 无效或已过期", 401);
    }

    if (!context.scopes.includes(requiredScope)) {
      return apiError("FORBIDDEN", "API Key 缺少所需权限范围", 403);
    }

    return handler(request, context, ...args);
  };
}
