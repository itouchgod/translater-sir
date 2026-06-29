ALTER TABLE "MeetingSegment"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

CREATE INDEX IF NOT EXISTS "MeetingSegment_search_vector_idx"
  ON "MeetingSegment" USING gin("search_vector");

CREATE OR REPLACE FUNCTION "update_meeting_segment_search_vector"()
RETURNS trigger AS $$
BEGIN
  NEW."search_vector" := to_tsvector(
    'simple',
    coalesce(NEW."originalText", '') || ' ' || coalesce(NEW."translatedText", '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "meeting_segment_search_vector_trigger" ON "MeetingSegment";

CREATE TRIGGER "meeting_segment_search_vector_trigger"
  BEFORE INSERT OR UPDATE ON "MeetingSegment"
  FOR EACH ROW EXECUTE FUNCTION "update_meeting_segment_search_vector"();

UPDATE "MeetingSegment"
SET "search_vector" = to_tsvector(
  'simple',
  coalesce("originalText", '') || ' ' || coalesce("translatedText", '')
);
