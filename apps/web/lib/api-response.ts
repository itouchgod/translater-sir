import { NextResponse } from "next/server";

type ApiError = {
  code: string;
  message: string;
};

export function apiSuccess<TData>(data: TData, init?: ResponseInit) {
  return NextResponse.json(
    {
      data,
      error: null,
    },
    init,
  );
}

export function apiError(code: string, message: string, status = 400, headers?: HeadersInit) {
  return NextResponse.json(
    {
      data: null,
      error: {
        code,
        message,
      } satisfies ApiError,
    },
    { status, headers },
  );
}
