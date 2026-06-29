import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requirePermission } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { invalidateGlossaryCache } from "@/lib/dictionaries";
import { ValidationError } from "@/lib/errors";
import { CreateDictionarySchema, DictionaryListQuerySchema } from "@/lib/validations/dictionary";

export const runtime = "nodejs";

export const GET = withApiHandler(async function GET(request: Request) {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    return apiSuccess([]);
  }

  await requirePermission(organizationId, "dictionary:manage");

  const parsed = DictionaryListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsed.success) {
    throw new ValidationError("术语库筛选参数无效");
  }

  const dictionaries = await db.dictionary.findMany({
    where: { organizationId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    take: parsed.data.limit,
    include: {
      _count: {
        select: {
          terms: true,
        },
      },
    },
  });

  return apiSuccess(dictionaries);
});

export const POST = withApiHandler(async function POST(request: Request) {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    throw new ValidationError("请先加入或创建组织");
  }

  await requirePermission(organizationId, "dictionary:manage");

  const parsed = CreateDictionarySchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "术语库信息无效");
  }

  const dictionary = await db.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.dictionary.updateMany({
        where: { organizationId },
        data: { isDefault: false },
      });
    }

    return tx.dictionary.create({
      data: {
        organizationId,
        name: parsed.data.name,
        description: parsed.data.description,
        isDefault: parsed.data.isDefault ?? false,
      },
    });
  });

  await invalidateGlossaryCache(organizationId);
  return apiSuccess(dictionary, { status: 201 });
});
