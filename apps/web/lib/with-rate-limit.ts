import { apiError } from "@/lib/api-response";
import {
  getRateLimitConfig,
  rateLimit,
  type RateLimitAction,
  type RateLimitResult,
} from "@/utils/rate-limit";

type RouteHandler<TArgs extends readonly unknown[]> = (
  request: Request,
  ...args: TArgs
) => Response | Promise<Response>;

type IdentifierGetter = (request: Request) => string | Promise<string>;

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export function getRateLimitHeaders(action: RateLimitAction, result: RateLimitResult) {
  const config = getRateLimitConfig(action);
  const headers = new Headers({
    "X-RateLimit-Limit": String(config.max),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
  });

  if (result.retryAfter) {
    headers.set("Retry-After", String(result.retryAfter));
  }

  return headers;
}

export function withRateLimit<TArgs extends readonly unknown[]>(
  action: RateLimitAction,
  getIdentifier: IdentifierGetter = getClientIp,
) {
  return (handler: RouteHandler<TArgs>): RouteHandler<TArgs> => {
    return async (request: Request, ...args: TArgs) => {
      const identifier = await getIdentifier(request);
      const result = await rateLimit(identifier, action);
      const headers = getRateLimitHeaders(action, result);

      if (!result.success) {
        return apiError("RATE_LIMITED", "请求过于频繁，请稍后再试", 429, headers);
      }

      const response = await handler(request, ...args);
      for (const [key, value] of headers) {
        response.headers.set(key, value);
      }

      return response;
    };
  };
}
