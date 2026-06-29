import type { PrismaClient } from "@prisma/client";
import type Redis from "ioredis";

declare global {
  var prisma: PrismaClient | undefined;
  var redis: Redis | undefined;

  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL?: string;
      REDIS_URL?: string;
      R2_ACCOUNT_ID?: string;
      R2_ACCESS_KEY_ID?: string;
      R2_SECRET_ACCESS_KEY?: string;
      R2_BUCKET_NAME?: string;
      R2_PUBLIC_URL?: string;
      AUTH_SECRET?: string;
      NEXTAUTH_SECRET?: string;
      NEXTAUTH_URL?: string;
      GOOGLE_CLIENT_ID?: string;
      GOOGLE_CLIENT_SECRET?: string;
      EMAIL_FROM?: string;
      SMTP_HOST?: string;
      SMTP_PORT?: string;
      SMTP_USER?: string;
      SMTP_PASSWORD?: string;
      SMTP_SECURE?: string;
      ABLY_API_KEY?: string;
      NEXT_PUBLIC_ABLY_CLIENT_KEY?: string;
      DEEPGRAM_API_KEY?: string;
      OPENAI_API_KEY?: string;
      STRIPE_SECRET_KEY?: string;
      STRIPE_WEBHOOK_SECRET?: string;
      LOG_LEVEL?: string;
    }
  }
}

export {};
