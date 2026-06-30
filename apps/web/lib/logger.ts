import pino from "pino";
import { randomUUID } from "node:crypto";

const isDevelopment = process.env.NODE_ENV !== "production";

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      code: "code" in error ? (error as { code?: unknown }).code : undefined,
      name: error.name,
    };
  }

  return error;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDevelopment ? "debug" : "info"),
  base: {
    requestId: null,
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  redact: {
    paths: [
      "password",
      "*.password",
      "token",
      "*.token",
      "secret",
      "*.secret",
      "authorization",
      "*.authorization",
      "cookie",
      "*.cookie",
      "req.headers.authorization",
      "req.headers.cookie",
      "headers.authorization",
      "headers.cookie",
    ],
    censor: "[REDACTED]",
  },
  serializers: {
    error: serializeError,
  },
  ...(isDevelopment
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname",
            translateTime: "SYS:standard",
          },
        },
      }
    : {}),
});

export function getRequestId(request: Request | null | undefined) {
  return request?.headers.get("x-request-id") ?? randomUUID();
}

export function logRequest(params: {
  request: Request;
  response: Response;
  startedAt: number;
  requestId: string;
}) {
  const url = new URL(params.request.url);

  logger.info(
    {
      requestId: params.requestId,
      method: params.request.method,
      url: `${url.pathname}${url.search}`,
      status: params.response.status,
      latencyMs: Date.now() - params.startedAt,
    },
    "HTTP request completed",
  );
}
