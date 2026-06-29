import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type SearchParams = {
  query: string;
  orgId: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  cursor?: string;
};

export type SearchSnippet = {
  segmentId: string;
  sequence: number;
  originalText: string;
  translatedText: string | null;
};

export type SearchResult = {
  meetingId: string;
  meetingTitle: string;
  meetingStatus: string;
  sourceLanguage: string;
  targetLanguage: string;
  createdAt: string;
  matchCount: number;
  snippets: SearchSnippet[];
};

type SearchRow = {
  meetingId: string;
  meetingTitle: string;
  meetingStatus: string;
  sourceLanguage: string;
  targetLanguage: string;
  createdAt: Date;
  matchCount: bigint | number;
  snippets: unknown;
};

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function parseCursor(cursor: string | undefined) {
  if (!cursor) {
    return 0;
  }

  const parsed = Number.parseInt(cursor, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeSnippets(value: unknown): SearchSnippet[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const snippet = item as Record<string, unknown>;

    if (
      typeof snippet.segmentId !== "string" ||
      typeof snippet.sequence !== "number" ||
      typeof snippet.originalText !== "string"
    ) {
      return [];
    }

    return [
      {
        segmentId: snippet.segmentId,
        sequence: snippet.sequence,
        originalText: snippet.originalText,
        translatedText: typeof snippet.translatedText === "string" ? snippet.translatedText : null,
      },
    ];
  });
}

export async function searchMeetings(params: SearchParams) {
  const query = params.query.trim();
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
  const offset = parseCursor(params.cursor);

  if (!query) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    };
  }

  const likeQuery = `%${escapeLike(query)}%`;
  const filters: Prisma.Sql[] = [
    Prisma.sql`m."organizationId" = ${params.orgId}`,
    Prisma.sql`(
      s."search_vector" @@ q.value
      OR s."originalText" ILIKE ${likeQuery} ESCAPE '\\'
      OR coalesce(s."translatedText", '') ILIKE ${likeQuery} ESCAPE '\\'
      OR m."title" ILIKE ${likeQuery} ESCAPE '\\'
      OR coalesce(m."summaryText", '') ILIKE ${likeQuery} ESCAPE '\\'
    )`,
  ];

  if (params.dateFrom) {
    filters.push(Prisma.sql`m."createdAt" >= ${params.dateFrom}`);
  }

  if (params.dateTo) {
    filters.push(Prisma.sql`m."createdAt" <= ${params.dateTo}`);
  }

  const rows = await db.$queryRaw<SearchRow[]>(Prisma.sql`
    WITH q AS (
      SELECT websearch_to_tsquery('simple', ${query}) AS value
    ),
    segment_matches AS (
      SELECT
        m."id" AS "meetingId",
        m."title" AS "meetingTitle",
        m."status"::text AS "meetingStatus",
        m."sourceLanguage" AS "sourceLanguage",
        m."targetLanguage" AS "targetLanguage",
        m."createdAt" AS "createdAt",
        s."id" AS "segmentId",
        s."sequence" AS "sequence",
        s."originalText" AS "originalText",
        s."translatedText" AS "translatedText",
        (
          ts_rank_cd(s."search_vector", q.value)
          + CASE
              WHEN s."originalText" ILIKE ${likeQuery} ESCAPE '\\'
                OR coalesce(s."translatedText", '') ILIKE ${likeQuery} ESCAPE '\\'
              THEN 0.25
              ELSE 0
            END
          + CASE
              WHEN m."title" ILIKE ${likeQuery} ESCAPE '\\'
                OR coalesce(m."summaryText", '') ILIKE ${likeQuery} ESCAPE '\\'
              THEN 0.1
              ELSE 0
            END
        ) AS "score"
      FROM "MeetingSegment" s
      JOIN "Meeting" m ON m."id" = s."meetingId"
      CROSS JOIN q
      WHERE ${Prisma.join(filters, " AND ")}
    ),
    meeting_scores AS (
      SELECT
        "meetingId",
        "meetingTitle",
        "meetingStatus",
        "sourceLanguage",
        "targetLanguage",
        "createdAt",
        count(*) AS "matchCount",
        sum("score") AS "totalScore",
        max("score") AS "maxScore"
      FROM segment_matches
      GROUP BY
        "meetingId",
        "meetingTitle",
        "meetingStatus",
        "sourceLanguage",
        "targetLanguage",
        "createdAt"
    ),
    paged_meetings AS (
      SELECT *
      FROM meeting_scores
      ORDER BY "totalScore" DESC, "maxScore" DESC, "matchCount" DESC, "createdAt" DESC, "meetingId" DESC
      LIMIT ${limit + 1}
      OFFSET ${offset}
    )
    SELECT
      p."meetingId",
      p."meetingTitle",
      p."meetingStatus",
      p."sourceLanguage",
      p."targetLanguage",
      p."createdAt",
      p."matchCount",
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'segmentId', sm."segmentId",
            'sequence', sm."sequence",
            'originalText', sm."originalText",
            'translatedText', sm."translatedText"
          )
          ORDER BY sm."score" DESC, sm."sequence" ASC
        ) FILTER (WHERE sm."segmentId" IS NOT NULL),
        '[]'::jsonb
      ) AS "snippets"
    FROM paged_meetings p
    LEFT JOIN LATERAL (
      SELECT *
      FROM segment_matches sm
      WHERE sm."meetingId" = p."meetingId"
      ORDER BY sm."score" DESC, sm."sequence" ASC
      LIMIT 3
    ) sm ON true
    GROUP BY
      p."meetingId",
      p."meetingTitle",
      p."meetingStatus",
      p."sourceLanguage",
      p."targetLanguage",
      p."createdAt",
      p."matchCount",
      p."totalScore",
      p."maxScore"
    ORDER BY p."totalScore" DESC, p."maxScore" DESC, p."matchCount" DESC, p."createdAt" DESC, p."meetingId" DESC
  `);
  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map<SearchResult>((row) => ({
    meetingId: row.meetingId,
    meetingTitle: row.meetingTitle,
    meetingStatus: row.meetingStatus,
    sourceLanguage: row.sourceLanguage,
    targetLanguage: row.targetLanguage,
    createdAt: row.createdAt.toISOString(),
    matchCount: Number(row.matchCount),
    snippets: normalizeSnippets(row.snippets),
  }));

  return {
    items,
    nextCursor: hasMore ? String(offset + limit) : null,
    hasMore,
  };
}
