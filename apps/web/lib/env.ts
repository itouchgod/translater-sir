import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
};

const requiredString = z.preprocess(emptyStringToUndefined, z.string().min(1));
const requiredUrl = z.preprocess(emptyStringToUndefined, z.string().url());
const optionalString = z.preprocess(emptyStringToUndefined, z.string().optional());
const optionalUrl = z.preprocess(emptyStringToUndefined, z.string().url().optional());

const EnvSchema = z
  .object({
    DATABASE_URL: requiredString,
    REDIS_URL: requiredString,
    AUTH_SECRET: optionalString,
    NEXTAUTH_SECRET: optionalString,
    NEXTAUTH_URL: requiredUrl,
    NEXT_PUBLIC_APP_URL: requiredUrl,
    R2_ACCOUNT_ID: requiredString,
    R2_ACCESS_KEY_ID: requiredString,
    R2_SECRET_ACCESS_KEY: requiredString,
    R2_BUCKET_NAME: requiredString,
    R2_PUBLIC_URL: requiredUrl,
    OPENAI_API_KEY: requiredString,
    OPENAI_BASE_URL: optionalUrl,
    DEEPGRAM_API_KEY: requiredString,
    ABLY_API_KEY: optionalString,
    NEXT_PUBLIC_ABLY_CLIENT_KEY: optionalString,
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    EMAIL_FROM: requiredString,
    SMTP_HOST: requiredString,
    SMTP_PORT: z.preprocess(emptyStringToUndefined, z.coerce.number().int().min(1).max(65535)),
    SMTP_USER: requiredString,
    SMTP_PASSWORD: requiredString,
    SMTP_SECURE: z.preprocess(emptyStringToUndefined, z.enum(["true", "false"]).default("false")),
    STRIPE_SECRET_KEY: requiredString,
    STRIPE_WEBHOOK_SECRET: requiredString,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: requiredString,
    STRIPE_PRICE_ID_STARTER: optionalString,
    STRIPE_PRICE_ID_PROFESSIONAL: optionalString,
    STRIPE_PRICE_ID_PRO: optionalString,
    STRIPE_PRICE_ID_ENTERPRISE: optionalString,
    AI_TRANSLATION_MODEL: optionalString,
    AI_SUMMARY_MODEL: optionalString,
    LOG_LEVEL: z
      .preprocess(emptyStringToUndefined, z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).optional()),
  })
  .refine((value) => Boolean(value.AUTH_SECRET || value.NEXTAUTH_SECRET), {
    message: "AUTH_SECRET or NEXTAUTH_SECRET is required",
    path: ["AUTH_SECRET"],
  });

function formatEnvError(error: z.ZodError) {
  return error.issues
    .map((issue) => {
      const key = issue.path.join(".") || "env";
      return `${key}: ${issue.message}`;
    })
    .join("\n");
}

function validateEnv() {
  const parsed = EnvSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(`Invalid environment variables:\n${formatEnvError(parsed.error)}`);
  }

  return parsed.data;
}

export const env =
  process.env.SKIP_ENV_VALIDATION === "1"
    ? (process.env as unknown as z.infer<typeof EnvSchema>)
    : validateEnv();
