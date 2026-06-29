import type { Dictionary } from "@prisma/client";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { redis } from "@/lib/redis";
import { requirePermission } from "@/lib/auth-helpers";

export async function getDictionaryForAccess(id: string) {
  const dictionary = await db.dictionary.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      name: true,
      description: true,
      isDefault: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!dictionary) {
    throw new NotFoundError("术语库不存在");
  }

  await requirePermission(dictionary.organizationId, "dictionary:manage");
  return dictionary;
}

export async function setDefaultDictionary(dictionary: Pick<Dictionary, "id" | "organizationId">) {
  await db.$transaction([
    db.dictionary.updateMany({
      where: {
        organizationId: dictionary.organizationId,
        id: {
          not: dictionary.id,
        },
      },
      data: {
        isDefault: false,
      },
    }),
    db.dictionary.update({
      where: { id: dictionary.id },
      data: { isDefault: true },
    }),
  ]);
}

export async function invalidateGlossaryCache(orgId: string) {
  const pattern = `glossary:${orgId}:*`;
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");
}

export function getExportFileName(dictionaryName: string) {
  const safeName = dictionaryName.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safeName || "dictionary"}-terms.csv`;
}
