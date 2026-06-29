import { createHash } from "crypto";
import { redis } from "@/lib/redis";
import { RedisKeys } from "@/utils/redis-keys";
import { RedisTTL } from "@/utils/redis-ttl";

export function createTranslationHash(params: {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  orgId: string;
}) {
  return createHash("md5")
    .update(
      JSON.stringify({
        text: params.text,
        sourceLanguage: params.sourceLanguage,
        targetLanguage: params.targetLanguage,
        orgId: params.orgId,
      }),
    )
    .digest("hex");
}

export async function getCachedTranslation(hash: string): Promise<string | null> {
  return redis.get(RedisKeys.translateCache(hash));
}

export async function setCachedTranslation(
  hash: string,
  result: string,
  ttl = RedisTTL.TRANSLATE_CACHE,
) {
  await redis.setex(RedisKeys.translateCache(hash), ttl, result);
}
