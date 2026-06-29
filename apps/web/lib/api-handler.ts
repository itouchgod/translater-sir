import { apiError } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

type ApiHandler<TArgs extends readonly unknown[]> = (...args: TArgs) => Response | Promise<Response>;

export function withApiHandler<TArgs extends readonly unknown[]>(
  handler: ApiHandler<TArgs>,
): ApiHandler<TArgs> {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        return apiError(error.code, error.message, error.status);
      }

      logger.error({ error }, "Unhandled API route error");
      return apiError("INTERNAL_ERROR", "服务器内部错误", 500);
    }
  };
}
