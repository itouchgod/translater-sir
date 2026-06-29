import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requirePermission } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { AppError, ValidationError } from "@/lib/errors";
import { sendOrganizationInvitationEmail } from "@/lib/mail";
import {
  INVITATION_TTL_SECONDS,
  storeInvitationToken,
} from "@/lib/organizations";
import { InviteMemberSchema } from "@/lib/validations/organization";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const POST = withApiHandler(async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const access = await requirePermission(id, "member:manage");

  const body = await request.json();
  const parsed = InviteMemberSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "邀请信息无效");
  }

  const existingMember = await db.member.findFirst({
    where: {
      organizationId: id,
      user: {
        email: parsed.data.email,
        deletedAt: null,
      },
    },
    select: { id: true },
  });

  if (existingMember) {
    throw new AppError("CONFLICT", "该用户已在组织中", 409);
  }

  const token = crypto.randomUUID();
  await storeInvitationToken(token, {
    orgId: id,
    email: parsed.data.email,
    role: parsed.data.role,
    invitedBy: access.session.user.id,
  });

  await sendOrganizationInvitationEmail({
    email: parsed.data.email,
    organizationName: access.organization.name,
    token,
    invitedByName: access.session.user.name,
  });

  return apiSuccess({
    invited: true,
    email: parsed.data.email,
    role: parsed.data.role,
    expiresIn: INVITATION_TTL_SECONDS,
  });
});
