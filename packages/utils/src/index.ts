export function assertDefined<TValue>(
  value: TValue | null | undefined,
  message: string,
): TValue {
  if (value === null || value === undefined) {
    throw new Error(message);
  }

  return value;
}
