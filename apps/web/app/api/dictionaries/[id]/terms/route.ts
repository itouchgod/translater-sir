import { Prisma } from "@prisma/client";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { getDictionaryForAccess, invalidateGlossaryCache } from "@/lib/dictionaries";
import { ValidationError } from "@/lib/errors";
import { CreateTermSchema, TermListQuerySchema } from "@/lib/validations/dictionary";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function buildSearchWhere(dictionaryId: string, query?: string): Prisma.DictionaryTermWhereInput {
  return {
    dictionaryId,
    ...(query
      ? {
          OR: [
            { source: { contains: query, mode: "insensitive" } },
            { target: { contains: query, mode: "insensitive" } },
            { notes: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export const GET = withApiHandler(async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const dictionary = await getDictionaryForAccess(id);
  const parsed = TermListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));

  if (!parsed.success) {
    throw new ValidationError("术语筛选参数无效");
  }

  const where = buildSearchWhere(dictionary.id, parsed.data.q);
  const [terms, totalTerms, totalCount] = await Promise.all([
    db.dictionaryTerm.findMany({
      where,
      orderBy: [{ source: "asc" }, { id: "asc" }],
      ...(parsed.data.cursor
        ? {
            cursor: { id: parsed.data.cursor },
            skip: 1,
          }
        : {}),
      take: parsed.data.limit + 1,
    }),
    db.dictionaryTerm.count({
      where: { dictionaryId: dictionary.id },
    }),
    db.dictionaryTerm.count({ where }),
  ]);
  const hasMore = terms.length > parsed.data.limit;
  const items = hasMore ? terms.slice(0, parsed.data.limit) : terms;

  return apiSuccess({
    items,
    totalTerms,
    totalCount,
    nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
    hasMore,
  });
});

export const POST = withApiHandler(async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const dictionary = await getDictionaryForAccess(id);
  const parsed = CreateTermSchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "术语信息无效");
  }

  const term = await db.dictionaryTerm.create({
    data: {
      dictionaryId: dictionary.id,
      source: parsed.data.source,
      target: parsed.data.target,
      language: parsed.data.language,
      notes: parsed.data.notes,
    },
  });

  await invalidateGlossaryCache(dictionary.organizationId);
  return apiSuccess(term, { status: 201 });
});
