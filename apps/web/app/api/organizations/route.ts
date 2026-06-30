import { MemberRole } from "@prisma/client";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { createOrganizationSlug } from "@/lib/organizations";
import { CreateOrganizationSchema } from "@/lib/validations/organization";
import { auditLog } from "@/utils/audit";

export const POST = withApiHandler(async function POST(request: Request) {
  const session = await requireAuth();

  const body = await request.json();
  const parsed = CreateOrganizationSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "组织信息无效");
  }

  const organization = await db.organization.create({
    data: {
      name: parsed.data.name,
      slug: createOrganizationSlug(parsed.data.name),
      members: {
        create: {
          userId: session.user.id,
          role: MemberRole.OWNER,
        },
      },
      dictionaries: {
        create: {
          name: "默认术语库",
          description: "创建组织时自动生成的默认术语库",
          isDefault: true,
        },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      plan: true,
      createdAt: true,
    },
  });
  void auditLog({
    userId: session.user.id,
    action: "org.create",
    resource: "Organization",
    resourceId: organization.id,
    metadata: { organizationId: organization.id, name: organization.name },
    request,
  });

  return apiSuccess(organization, { status: 201 });
});
