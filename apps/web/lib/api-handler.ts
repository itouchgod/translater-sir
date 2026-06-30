import { apiError } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { getRequestId, logger, logRequest } from "@/lib/logger";

type ApiHandler<TArgs extends readonly unknown[]> = (...args: TArgs) => Response | Promise<Response>;

function getRequestFromArgs(args: readonly unknown[]) {
  const first = args[0];
  return first instanceof Request ? first : null;
}

function finalizeResponse(response: Response, request: Request | null, startedAt: number, requestId: string) {
  response.headers.set("x-request-id", requestId);

  if (request) {
    logRequest({ request, response, startedAt, requestId });
  }

  return response;
}

export function withApiHandler<TArgs extends readonly unknown[]>(
  handler: ApiHandler<TArgs>,
): ApiHandler<TArgs> {
  return async (...args: TArgs) => {
    const request = getRequestFromArgs(args);
    const startedAt = Date.now();
    const requestId = getRequestId(request);

    try {
      return finalizeResponse(await handler(...args), request, startedAt, requestId);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        return finalizeResponse(apiError(error.code, error.message, error.status), request, startedAt, requestId);
      }

      logger.error({ error, requestId }, "Unhandled API route error");
      return finalizeResponse(apiError("INTERNAL_ERROR", "服务器内部错误", 500), request, startedAt, requestId);
    }
  };
}
