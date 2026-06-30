function normalizeTagSegment(value: string) {
  return value.trim();
}

export const CacheTags = {
  meetings: (orgId: string) => `meetings:${normalizeTagSegment(orgId)}`,
} as const;
