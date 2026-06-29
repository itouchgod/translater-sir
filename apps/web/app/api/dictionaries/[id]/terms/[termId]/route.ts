import { Prisma } from "@prisma/client";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { getDictionaryForAccess, invalidateGlossaryCache } from "@/lib/dictionaries";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { UpdateTermSchema } from "@/lib/validations/dictionary";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; termId: string }>;
};

async function getTermForDictionary(dictionaryId: string, termId: string) {
  const term = await db.dictionaryTerm.findFirst({
    where: {
      id: termId,
      dictionaryId,
    },
  });

  if (!term) {
    throw new NotFoundError("术语不存在");
  }

  return term;
}

export const PATCH = withApiHandler(async function PATCH(request: Request, context: RouteContext) {
  const { id, termId } = await context.params;
  const dictionary = await getDictionaryForAccess(id);
  await getTermForDictionary(dictionary.id, termId);
  const parsed = UpdateTermSchema.safeParse(await request.json());

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "术语信息无效");
  }

  try {
    const term = await db.dictionaryTerm.update({
      where: { id: termId },
      data: parsed.data,
    });

    await invalidateGlossaryCache(dictionary.organizationId);
    return apiSuccess(term);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("术语不存在");
    }

    throw error;
  }
});

export const DELETE = withApiHandler(async function DELETE(_request: Request, context: RouteContext) {
  const { id, termId } = await context.params;
  const dictionary = await getDictionaryForAccess(id);
  await getTermForDictionary(dictionary.id, termId);

  try {
    await db.dictionaryTerm.delete({
      where: { id: termId },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("术语不存在");
    }

    throw error;
  }

  await invalidateGlossaryCache(dictionary.organizationId);
  return apiSuccess({ deleted: true });
});
