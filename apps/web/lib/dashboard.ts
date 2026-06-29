import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { RedisKeys } from "@/utils/redis-keys";
import { RedisTTL } from "@/utils/redis-ttl";

export type DashboardStats = {
  meetingsThisMonth: number;
  totalMeetings: number;
  hoursTranslatedThisMonth: number;
  aiCallsThisMonth: number;
  tokensUsedThisMonth: number;
  changes: {
    meetings: number | null;
    hours: number | null;
    aiCalls: number | null;
    tokens: number | null;
  };
  dailyMeetings: Array<{
    date: string;
    count: number;
  }>;
  languagePairStats: Array<{
    pair: string;
    count: number;
  }>;
  recentMeetings: Array<{
    id: string;
    title: string;
    status: string;
    sourceLanguage: string;
    targetLanguage: string;
    startedAt: string | null;
    endedAt: string | null;
    createdAt: string;
    _count: {
      segments: number;
      files: number;
    };
  }>;
};

type CountRow = {
  count: bigint | number;
};

type NumberRow = {
  value: number | string | null;
};

type DailyRow = {
  date: Date | string;
  count: bigint | number;
};

type LanguagePairRow = {
  pair: string;
  count: bigint | number;
};

function getMonthBounds(now = new Date()) {
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  return {
    currentMonthStart,
    nextMonthStart,
    previousMonthStart,
  };
}

function calculateChange(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 100 : null;
  }

  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function toNumber(value: bigint | number | string | null | undefined) {
  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return value ?? 0;
}

async function getCount(sql: Prisma.Sql) {
  const rows = await db.$queryRaw<CountRow[]>(sql);
  return toNumber(rows[0]?.count);
}

async function getNumberValue(sql: Prisma.Sql) {
  const rows = await db.$queryRaw<NumberRow[]>(sql);
  return toNumber(rows[0]?.value);
}

async function buildDashboardStats(orgId: string): Promise<DashboardStats> {
  const { currentMonthStart, nextMonthStart, previousMonthStart } = getMonthBounds();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [
    meetingsThisMonth,
    meetingsPreviousMonth,
    totalMeetings,
    minutesThisMonth,
    minutesPreviousMonth,
    aiCallsThisMonth,
    aiCallsPreviousMonth,
    tokensUsedThisMonth,
    tokensUsedPreviousMonth,
    dailyRows,
    languageRows,
    recentMeetings,
  ] = await Promise.all([
    getCount(Prisma.sql`
      SELECT count(*) AS count
      FROM "Meeting"
      WHERE "organizationId" = ${orgId}
        AND "createdAt" >= ${currentMonthStart}
        AND "createdAt" < ${nextMonthStart}
    `),
    getCount(Prisma.sql`
      SELECT count(*) AS count
      FROM "Meeting"
      WHERE "organizationId" = ${orgId}
        AND "createdAt" >= ${previousMonthStart}
        AND "createdAt" < ${currentMonthStart}
    `),
    getCount(Prisma.sql`
      SELECT count(*) AS count
      FROM "Meeting"
      WHERE "organizationId" = ${orgId}
    `),
    getNumberValue(Prisma.sql`
      SELECT coalesce(sum(extract(epoch FROM ("endedAt" - "startedAt")) / 60), 0) AS value
      FROM "Meeting"
      WHERE "organizationId" = ${orgId}
        AND "startedAt" IS NOT NULL
        AND "endedAt" IS NOT NULL
        AND "endedAt" >= ${currentMonthStart}
        AND "endedAt" < ${nextMonthStart}
    `),
    getNumberValue(Prisma.sql`
      SELECT coalesce(sum(extract(epoch FROM ("endedAt" - "startedAt")) / 60), 0) AS value
      FROM "Meeting"
      WHERE "organizationId" = ${orgId}
        AND "startedAt" IS NOT NULL
        AND "endedAt" IS NOT NULL
        AND "endedAt" >= ${previousMonthStart}
        AND "endedAt" < ${currentMonthStart}
    `),
    getCount(Prisma.sql`
      SELECT count(*) AS count
      FROM "AiLog" a
      JOIN "Meeting" m ON m."id" = a."meetingId"
      WHERE m."organizationId" = ${orgId}
        AND a."createdAt" >= ${currentMonthStart}
        AND a."createdAt" < ${nextMonthStart}
    `),
    getCount(Prisma.sql`
      SELECT count(*) AS count
      FROM "AiLog" a
      JOIN "Meeting" m ON m."id" = a."meetingId"
      WHERE m."organizationId" = ${orgId}
        AND a."createdAt" >= ${previousMonthStart}
        AND a."createdAt" < ${currentMonthStart}
    `),
    getNumberValue(Prisma.sql`
      SELECT coalesce(sum(a."inputTokens" + a."outputTokens"), 0) AS value
      FROM "AiLog" a
      JOIN "Meeting" m ON m."id" = a."meetingId"
      WHERE m."organizationId" = ${orgId}
        AND a."createdAt" >= ${currentMonthStart}
        AND a."createdAt" < ${nextMonthStart}
    `),
    getNumberValue(Prisma.sql`
      SELECT coalesce(sum(a."inputTokens" + a."outputTokens"), 0) AS value
      FROM "AiLog" a
      JOIN "Meeting" m ON m."id" = a."meetingId"
      WHERE m."organizationId" = ${orgId}
        AND a."createdAt" >= ${previousMonthStart}
        AND a."createdAt" < ${currentMonthStart}
    `),
    db.$queryRaw<DailyRow[]>(Prisma.sql`
      SELECT days.day::date AS date, coalesce(count(m."id"), 0) AS count
      FROM generate_series(${sevenDaysAgo}::date, now()::date, interval '1 day') AS days(day)
      LEFT JOIN "Meeting" m
        ON m."organizationId" = ${orgId}
       AND m."createdAt" >= days.day
       AND m."createdAt" < days.day + interval '1 day'
      GROUP BY days.day
      ORDER BY days.day ASC
    `),
    db.$queryRaw<LanguagePairRow[]>(Prisma.sql`
      SELECT concat("sourceLanguage", ' -> ', "targetLanguage") AS pair, count(*) AS count
      FROM "Meeting"
      WHERE "organizationId" = ${orgId}
      GROUP BY "sourceLanguage", "targetLanguage"
      ORDER BY count(*) DESC, pair ASC
      LIMIT 8
    `),
    db.meeting.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        _count: {
          select: {
            segments: true,
            files: true,
          },
        },
      },
    }),
  ]);

  const hoursThisMonth = Number((minutesThisMonth / 60).toFixed(1));
  const hoursPreviousMonth = Number((minutesPreviousMonth / 60).toFixed(1));

  return {
    meetingsThisMonth,
    totalMeetings,
    hoursTranslatedThisMonth: hoursThisMonth,
    aiCallsThisMonth,
    tokensUsedThisMonth,
    changes: {
      meetings: calculateChange(meetingsThisMonth, meetingsPreviousMonth),
      hours: calculateChange(hoursThisMonth, hoursPreviousMonth),
      aiCalls: calculateChange(aiCallsThisMonth, aiCallsPreviousMonth),
      tokens: calculateChange(tokensUsedThisMonth, tokensUsedPreviousMonth),
    },
    dailyMeetings: dailyRows.map((row) => ({
      date: new Date(row.date).toISOString().slice(0, 10),
      count: toNumber(row.count),
    })),
    languagePairStats: languageRows.map((row) => ({
      pair: row.pair,
      count: toNumber(row.count),
    })),
    recentMeetings: recentMeetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      status: meeting.status,
      sourceLanguage: meeting.sourceLanguage,
      targetLanguage: meeting.targetLanguage,
      startedAt: meeting.startedAt?.toISOString() ?? null,
      endedAt: meeting.endedAt?.toISOString() ?? null,
      createdAt: meeting.createdAt.toISOString(),
      _count: meeting._count,
    })),
  };
}

export async function getDashboardStats(orgId: string) {
  const key = RedisKeys.dashboardStats(orgId);
  const cached = await redis.get(key);

  if (cached) {
    return JSON.parse(cached) as DashboardStats;
  }

  const stats = await buildDashboardStats(orgId);
  await redis.setex(key, RedisTTL.DASHBOARD_STATS, JSON.stringify(stats));

  return stats;
}

export async function invalidateDashboardStats(orgId: string) {
  await redis.del(RedisKeys.dashboardStats(orgId));
}
