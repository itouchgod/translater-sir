import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requireOrgMember } from "@/lib/auth-helpers";
import { getDashboardStats, type DashboardStats } from "@/lib/dashboard";

export const runtime = "nodejs";

const emptyStats: DashboardStats = {
  meetingsThisMonth: 0,
  totalMeetings: 0,
  hoursTranslatedThisMonth: 0,
  aiCallsThisMonth: 0,
  tokensUsedThisMonth: 0,
  changes: {
    meetings: null,
    hours: null,
    aiCalls: null,
    tokens: null,
  },
  dailyMeetings: [],
  languagePairStats: [],
  recentMeetings: [],
};

export const GET = withApiHandler(async function GET() {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;

  if (!organizationId) {
    return apiSuccess(emptyStats);
  }

  await requireOrgMember(organizationId);
  const stats = await getDashboardStats(organizationId);

  return apiSuccess(stats);
});
