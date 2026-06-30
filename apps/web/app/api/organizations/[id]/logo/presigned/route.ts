import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requirePermission } from "@/lib/auth-helpers";
import { ValidationError } from "@/lib/errors";
import { getR2Key, getR2PublicUrl, getSignedUploadUrl } from "@/lib/r2";
import { OrganizationLogoUploadSchema } from "@/lib/validations/organization";
import { validateMagicBytes } from "@/utils/upload-validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function extensionForContentType(contentType: string) {
  if (contentType === "image/png") {
    return "png";
  }

  if (contentType === "image/webp") {
    return "webp";
  }

  return "jpg";
}

export const POST = withApiHandler(async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  await requirePermission(id, "member:manage");

  const body = await request.json();
  const parsed = OrganizationLogoUploadSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Logo 文件无效");
  }

  const magicBytesValidation = validateMagicBytes(parsed.data.contentType, parsed.data.magicBytes);
  if (!magicBytesValidation.valid) {
    throw new ValidationError(magicBytesValidation.error);
  }

  const key = getR2Key(
    "organizationLogo",
    id,
    `${crypto.randomUUID()}.${extensionForContentType(parsed.data.contentType)}`,
  );
  const uploadUrl = await getSignedUploadUrl(key, parsed.data.contentType, 300);

  return apiSuccess({
    uploadUrl,
    key,
    publicUrl: getR2PublicUrl(key),
    expiresIn: 300,
  });
});
