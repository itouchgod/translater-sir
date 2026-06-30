function normalizeSegment(value: string) {
  return value.trim();
}

export const RedisKeys = {
  session: (id: string) => `session:${normalizeSegment(id)}`,
  jwtBlacklist: (jti: string) => `jwt:blacklist:${normalizeSegment(jti)}`,
  userJwtInvalidatedBefore: (userId: string) =>
    `jwt:user-invalidated-before:${normalizeSegment(userId)}`,
  verification: (token: string) => `verification:${normalizeSegment(token)}`,
  invitation: (token: string) => `invitation:${normalizeSegment(token)}`,
  resetPassword: (token: string) => `reset-password:${normalizeSegment(token)}`,
  rateLimit: (action: string, id: string) =>
    `ratelimit:${normalizeSegment(action)}:${normalizeSegment(id)}`,
  meetingSubtitle: (meetingId: string) => `meeting:subtitle:${normalizeSegment(meetingId)}`,
  meetingStatus: (meetingId: string) => `meeting:status:${normalizeSegment(meetingId)}`,
  meetingOnline: (meetingId: string) => `meeting:online:${normalizeSegment(meetingId)}`,
  wsConnection: (connId: string) => `ws:connection:${normalizeSegment(connId)}`,
  translateCache: (hash: string) => `translate:cache:${normalizeSegment(hash)}`,
  ttsCache: (hash: string) => `tts:cache:${normalizeSegment(hash)}`,
  aiContext: (meetingId: string) => `ai:context:${normalizeSegment(meetingId)}`,
  downloadToken: (token: string) => `download:token:${normalizeSegment(token)}`,
  dashboardStats: (orgId: string) => `dashboard:stats:${normalizeSegment(orgId)}`,
  userMe: (userId: string) => `user:me:${normalizeSegment(userId)}`,
  organization: (orgId: string) => `organization:${normalizeSegment(orgId)}`,
  billingCurrent: (orgId: string) => `billing:current:${normalizeSegment(orgId)}`,
  glossary: (orgId: string, src: string, tgt: string) =>
    `glossary:${normalizeSegment(orgId)}:${normalizeSegment(src)}:${normalizeSegment(tgt)}`,
} as const;
