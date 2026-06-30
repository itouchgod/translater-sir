-- Meeting list: WHERE "organizationId" = ? ORDER BY "createdAt" DESC, "id" DESC
CREATE INDEX IF NOT EXISTS "Meeting_organizationId_createdAt_id_idx"
ON "Meeting"("organizationId", "createdAt" DESC, "id" DESC);

-- Subtitle history: WHERE "meetingId" = ? ORDER BY "sequence" ASC
CREATE INDEX IF NOT EXISTS "MeetingSegment_meetingId_sequence_idx"
ON "MeetingSegment"("meetingId", "sequence");

-- AI log analytics: WHERE "createdAt" BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS "AiLog_createdAt_id_idx"
ON "AiLog"("createdAt" DESC, "id" DESC);

-- Audit log user filter: WHERE "userId" = ? ORDER BY "createdAt" DESC
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_id_idx"
ON "AuditLog"("userId", "createdAt" DESC, "id" DESC);
