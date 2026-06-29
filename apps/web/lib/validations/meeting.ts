import { MeetingStatus } from "@prisma/client";
import { z } from "zod";
import { isSupportedLanguagePair } from "@/utils/languages";

const MeetingLanguageSchema = z
  .object({
    sourceLanguage: z.string().trim().min(2).max(12),
    targetLanguage: z.string().trim().min(2).max(12),
  })
  .refine((value) => isSupportedLanguagePair(value.sourceLanguage, value.targetLanguage), {
    message: "不支持该语言对",
    path: ["targetLanguage"],
  });

export const CreateMeetingSchema = z
  .object({
    title: z.string().trim().min(1, "会议标题不能为空").max(120, "会议标题不能超过 120 个字符"),
  })
  .and(MeetingLanguageSchema);

export const UpdateMeetingSchema = z
  .object({
    title: z.string().trim().min(1, "会议标题不能为空").max(120, "会议标题不能超过 120 个字符").optional(),
  })
  .and(MeetingLanguageSchema.partial())
  .refine((value) => Object.keys(value).length > 0, {
    message: "没有可更新的字段",
  });

export const MeetingListQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(MeetingStatus).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type CreateMeetingInput = z.infer<typeof CreateMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof UpdateMeetingSchema>;
