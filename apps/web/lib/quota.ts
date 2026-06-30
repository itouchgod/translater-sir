import { Plan } from "@prisma/client";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/stripe";

export type Usage = {
  meetingsThisMonth: number;
  members: number;
  aiCallsThisMonth: number;
};

export type QuotaResult = {
  allowed: boolean;
  plan: Plan;
  reason?: string;
};

function getMonthRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return { start, end };
}

function quotaLabel(limit: number) {
  return limit < 0 ? "不限" : String(limit);
}

export async function getCurrentUsage(orgId: string): Promise<Usage> {
  const { start, end } = getMonthRange();

  const [meetingsThisMonth, members, aiCallsThisMonth] = await Promise.all([
    db.meeting.count({
      where: {
        organizationId: orgId,
        createdAt: {
          gte: start,
          lt: end,
        },
      },
    }),
    db.member.count({
      where: {
        organizationId: orgId,
      },
    }),
    db.aiLog.count({
      where: {
        createdAt: {
          gte: start,
          lt: end,
        },
        meeting: {
          organizationId: orgId,
        },
      },
    }),
  ]);

  return {
    meetingsThisMonth,
    members,
    aiCallsThisMonth,
  };
}

export async function checkMeetingQuota(orgId: string): Promise<QuotaResult> {
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });
  const plan = organization?.plan ?? Plan.FREE;
  const limit = PLANS[plan].meetingsPerMonth;

  if (limit < 0) {
    return { allowed: true, plan };
  }

  const { start, end } = getMonthRange();
  const used = await db.meeting.count({
    where: {
      organizationId: orgId,
      createdAt: {
        gte: start,
        lt: end,
      },
    },
  });

  if (used >= limit) {
    return {
      allowed: false,
      plan,
      reason: `当前 ${PLANS[plan].name} 计划本月会议额度已用完（${used}/${quotaLabel(limit)}），请升级订阅后继续创建会议。`,
    };
  }

  return { allowed: true, plan };
}

export async function checkMemberQuota(orgId: string): Promise<QuotaResult> {
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  });
  const plan = organization?.plan ?? Plan.FREE;
  const limit = PLANS[plan].membersLimit;

  if (limit < 0) {
    return { allowed: true, plan };
  }

  const used = await db.member.count({
    where: { organizationId: orgId },
  });

  if (used >= limit) {
    return {
      allowed: false,
      plan,
      reason: `当前 ${PLANS[plan].name} 计划成员额度已用完（${used}/${quotaLabel(limit)}），请升级订阅后继续邀请成员。`,
    };
  }

  return { allowed: true, plan };
}
