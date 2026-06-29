import { Prisma } from "@prisma/client";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { getDictionaryForAccess, invalidateGlossaryCache } from "@/lib/dictionaries";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { UpdateDictionarySchema } from "@/lib/validations/dictionary";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const GET = withApiHandler(async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const dictionary = await getDictionaryForAccess(id);
  const detail = await db.dictionary.findUnique({
    where: { id: dictionary.id },
    include: {
      _count: {
        select: {
          terms: true,
        },
      },
    },
  });

  if (!detail) {
    throw new NotFoundError("术语库不存在");
  }

  return apiSuccess(detail);
});

export const PATCH = withApiHandler(async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const dictionary = await getDictionaryForAccess(id);
  const parsed = UpdateDictionarySchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "术语库信息无效");
  }

  const updated = await db.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.dictionary.updateMany({
        where: {
          organizationId: dictionary.organizationId,
          id: {
            not: dictionary.id,
          },
        },
        data: {
          isDefault: false,
        },
      });
    }

    return tx.dictionary.update({
      where: { id: dictionary.id },
      data: parsed.data,
    });
  });

  await invalidateGlossaryCache(dictionary.organizationId);
  return apiSuccess(updated);
});

export const DELETE = withApiHandler(async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const dictionary = await getDictionaryForAccess(id);

  if (dictionary.isDefault) {
    throw new ValidationError("默认术语库不可删除");
  }

  try {
    await db.dictionary.delete({
      where: { id: dictionary.id },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("术语库不存在");
    }

    throw error;
  }

  await invalidateGlossaryCache(dictionary.organizationId);
  return apiSuccess({ deleted: true });
});
