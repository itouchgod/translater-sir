import { z } from "zod";

export const UpdateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "姓名至少需要 2 个字符")
    .max(50, "姓名最多 50 个字符"),
});

const avatarContentTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

export const PresignedAvatarUploadSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, "文件名不能为空")
    .max(180, "文件名过长"),
  contentType: z.enum(avatarContentTypes, {
    message: "头像仅支持 jpeg、png、webp 格式",
  }),
  sizeBytes: z
    .number()
    .int("文件大小无效")
    .positive("文件大小无效")
    .max(MAX_AVATAR_SIZE_BYTES, "头像不能超过 5MB"),
});

export const ConfirmAvatarSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "头像文件 Key 不能为空")
    .max(512, "头像文件 Key 过长"),
  contentType: z.enum(avatarContentTypes, {
    message: "头像仅支持 jpeg、png、webp 格式",
  }),
  sizeBytes: z
    .number()
    .int("文件大小无效")
    .positive("文件大小无效")
    .max(MAX_AVATAR_SIZE_BYTES, "头像不能超过 5MB"),
});

const strongPasswordSchema = z
  .string()
  .min(8, "密码至少需要 8 个字符")
  .max(128, "密码最多 128 个字符")
  .regex(/[A-Z]/, "密码需要包含至少 1 个大写字母")
  .regex(/[a-z]/, "密码需要包含至少 1 个小写字母")
  .regex(/[0-9]/, "密码需要包含至少 1 个数字")
  .regex(/[^A-Za-z0-9]/, "密码需要包含至少 1 个特殊字符");

export const UpdatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "请输入当前密码"),
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "请再次输入新密码"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "两次输入的新密码不一致",
  })
  .refine((value) => value.currentPassword !== value.password, {
    path: ["password"],
    message: "新密码不能与当前密码相同",
  });

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type PresignedAvatarUploadInput = z.infer<typeof PresignedAvatarUploadSchema>;
export type ConfirmAvatarInput = z.infer<typeof ConfirmAvatarSchema>;
export type UpdatePasswordInput = z.infer<typeof UpdatePasswordSchema>;
