import type { GlossaryEntry, MatchedTerm } from "@/lib/translation/types";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { RedisKeys } from "@/utils/redis-keys";
import { RedisTTL } from "@/utils/redis-ttl";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function loadGlossary(
  orgId: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<GlossaryEntry[]> {
  const cacheKey = RedisKeys.glossary(orgId, sourceLanguage, targetLanguage);
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached) as GlossaryEntry[];
  }

  const terms = await db.dictionaryTerm.findMany({
    where: {
      language: `${sourceLanguage}-${targetLanguage}`,
      dictionary: {
        organizationId: orgId,
      },
    },
    select: {
      id: true,
      source: true,
      target: true,
      language: true,
    },
    orderBy: {
      source: "asc",
    },
  });

  await redis.setex(cacheKey, RedisTTL.GLOSSARY, JSON.stringify(terms));
  return terms;
}

export function applyGlossary(text: string, glossary: GlossaryEntry[]) {
  let processedText = text;
  const matchedTerms: MatchedTerm[] = [];

  for (const entry of glossary) {
    const source = entry.source.trim();

    if (!source) {
      continue;
    }

    const pattern = new RegExp(escapeRegExp(source), "gi");
    let count = 0;
    processedText = processedText.replace(pattern, () => {
      count += 1;
      return entry.target;
    });

    if (count > 0) {
      matchedTerms.push({
        source: entry.source,
        target: entry.target,
        count,
      });
    }
  }

  return {
    processedText,
    matchedTerms,
  };
}
