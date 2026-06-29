import { z } from "zod";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requireOrgMember } from "@/lib/auth-helpers";
import { ValidationError } from "@/lib/errors";
import { searchMeetings } from "@/lib/search";

export const runtime = "nodejs";

const SearchQuerySchema = z.object({
  q: z.string().trim().min(1, "搜索关键词不能为空").max(100, "搜索关键词不能超过 100 个字符"),
  orgId: z.string().trim().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().trim().min(1).optional(),
});

export const GET = withApiHandler(async function GET(request: Request) {
  const session = await requireAuth();
  const parsed = SearchQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "搜索参数无效");
  }

  const orgId = parsed.data.orgId ?? session.user.organizationId;

  if (!orgId) {
    return apiSuccess({
      items: [],
      nextCursor: null,
      hasMore: false,
    });
  }

  await requireOrgMember(orgId);

  const result = await searchMeetings({
    query: parsed.data.q,
    orgId,
    dateFrom: parsed.data.dateFrom,
    dateTo: parsed.data.dateTo,
    limit: parsed.data.limit,
    cursor: parsed.data.cursor,
  });

  return apiSuccess(result);
});
