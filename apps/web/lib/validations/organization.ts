import { MemberRole } from "@prisma/client";
import { z } from "zod";

const organizationLogoContentTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export const MAX_ORGANIZATION_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

export const CreateOrganizationSchema = z.object({
  name: z.string().trim().min(1, "组织名称不能为空").max(80, "组织名称不能超过 80 个字符"),
});

export const UpdateOrganizationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "组织名称不能为空")
      .max(80, "组织名称不能超过 80 个字符")
      .optional(),
    logoKey: z.string().trim().min(1, "Logo 文件 Key 无效").optional(),
    logoContentType: z.enum(organizationLogoContentTypes).optional(),
    logoSizeBytes: z.number().int().positive().max(MAX_ORGANIZATION_LOGO_SIZE_BYTES).optional(),
  })
  .refine((value) => value.name || value.logoKey, {
    message: "至少需要提交一个更新字段",
  })
  .refine(
    (value) =>
      !value.logoKey ||
      (Boolean(value.logoContentType) && typeof value.logoSizeBytes === "number"),
    {
      message: "Logo 文件信息不完整",
    },
  );

export const OrganizationLogoUploadSchema = z.object({
  fileName: z.string().trim().min(1, "文件名不能为空").max(180, "文件名过长"),
  contentType: z.enum(organizationLogoContentTypes, {
    message: "Logo 仅支持 jpeg、png、webp 格式",
  }),
  magicBytes: z.string().trim().min(6, "缺少文件签名信息").max(24, "文件签名信息无效"),
  sizeBytes: z
    .number()
    .int()
    .positive("文件大小无效")
    .max(MAX_ORGANIZATION_LOGO_SIZE_BYTES, "Logo 不能超过 5MB"),
});

export const InviteMemberSchema = z.object({
  email: z.email("请输入有效邮箱").trim().toLowerCase(),
  role: z.enum([MemberRole.ADMIN, MemberRole.MEMBER, MemberRole.VIEWER], {
    message: "邀请角色无效",
  }),
});

export const UpdateMemberRoleSchema = z.object({
  role: z.enum([MemberRole.ADMIN, MemberRole.MEMBER, MemberRole.VIEWER], {
    message: "成员角色无效",
  }),
});

export const MembersQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;
