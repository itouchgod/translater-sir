import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "密码至少需要 8 个字符")
  .max(128, "密码最多 128 个字符")
  .regex(/[A-Z]/, "密码需要包含至少 1 个大写字母")
  .regex(/[a-z]/, "密码需要包含至少 1 个小写字母")
  .regex(/[0-9]/, "密码需要包含至少 1 个数字")
  .regex(/[^A-Za-z0-9]/, "密码需要包含至少 1 个特殊字符");

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("请输入有效的邮箱地址"),
  password: z.string().min(1, "请输入密码"),
});

export const RegisterSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "姓名至少需要 2 个字符")
      .max(50, "姓名最多 50 个字符"),
    email: z.string().trim().toLowerCase().email("请输入有效的邮箱地址"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "请再次输入密码"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "两次输入的密码不一致",
  });

export const ForgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("请输入有效的邮箱地址"),
});

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, "重置链接无效"),
    email: z.string().trim().toLowerCase().email("请输入有效的邮箱地址"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "请再次输入密码"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "两次输入的密码不一致",
  });

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
