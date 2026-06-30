import { redis } from "@/lib/redis";
import { RedisKeys } from "@/utils/redis-keys";

export async function invalidateUserMeCache(userId: string) {
  await redis.del(RedisKeys.userMe(userId));
}

export async function invalidateOrganizationCache(orgId: string) {
  await redis.del(RedisKeys.organization(orgId));
}

export async function invalidateBillingCurrentCache(orgId: string) {
  await redis.del(RedisKeys.billingCurrent(orgId));
}
