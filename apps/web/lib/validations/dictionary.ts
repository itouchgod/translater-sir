import { z } from "zod";
import { isSupportedLanguage, isSupportedLanguagePair } from "@/utils/languages";

export const DictionaryListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const CreateDictionarySchema = z.object({
  name: z.string().trim().min(1, "术语库名称不能为空").max(80, "术语库名称不能超过 80 个字符"),
  description: z
    .string()
    .trim()
    .max(500, "术语库描述不能超过 500 个字符")
    .optional()
    .nullable()
    .transform((value) => value || null),
  isDefault: z.boolean().optional(),
});

export const UpdateDictionarySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "术语库名称不能为空")
      .max(80, "术语库名称不能超过 80 个字符")
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, "术语库描述不能超过 500 个字符")
      .optional()
      .nullable()
      .transform((value) => value || null),
    isDefault: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "没有可更新的字段",
  });

export const TermListQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  q: z.string().trim().max(100).optional(),
});

export const TermLanguageSchema = z
  .string()
  .trim()
  .min(2, "语言不能为空")
  .max(24, "语言格式过长")
  .transform((value) => normalizeTermLanguage(value))
  .refine((value) => {
    const [source, target] = value.split("-");
    return Boolean(source && target && isSupportedLanguagePair(source, target));
  }, "不支持该语言对");

export const CreateTermSchema = z.object({
  source: z.string().trim().min(1, "原文不能为空").max(200, "原文不能超过 200 个字符"),
  target: z.string().trim().min(1, "译文不能为空").max(200, "译文不能超过 200 个字符"),
  language: TermLanguageSchema,
  notes: z
    .string()
    .trim()
    .max(500, "备注不能超过 500 个字符")
    .optional()
    .nullable()
    .transform((value) => value || null),
});

export const UpdateTermSchema = CreateTermSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: "没有可更新的字段",
  },
);

export type CreateDictionaryInput = z.infer<typeof CreateDictionarySchema>;
export type UpdateDictionaryInput = z.infer<typeof UpdateDictionarySchema>;
export type CreateTermInput = z.infer<typeof CreateTermSchema>;
export type UpdateTermInput = z.infer<typeof UpdateTermSchema>;

export function normalizeTermLanguage(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized.includes("-")) {
    const [source, target] = normalized.split("-");
    return `${source}-${target}`;
  }

  if (isSupportedLanguage(normalized)) {
    return normalized === "zh" ? "en-zh" : `zh-${normalized}`;
  }

  return normalized;
}
