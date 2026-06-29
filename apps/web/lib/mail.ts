import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";

type MailParams = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

export async function sendMail(params: MailParams) {
  if (!hasSmtpConfig()) {
    logger.warn(
      {
        to: params.to,
        subject: params.subject,
      },
      "SMTP is not configured; email was not sent",
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? "Speech Interpreter <no-reply@example.com>",
    ...params,
  });
}

export async function sendVerificationEmail(params: {
  email: string;
  token: string;
  name?: string | null;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const verifyUrl = `${appUrl}/login?verifiedToken=${encodeURIComponent(params.token)}`;
  const greeting = params.name ? `${params.name}，你好` : "你好";

  await sendMail({
    to: params.email,
    subject: "验证你的 Speech Interpreter 账号",
    text: `${greeting}，请打开以下链接验证邮箱：${verifyUrl}`,
    html: `<p>${greeting}，</p><p>请点击链接验证你的邮箱：</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
}

export async function sendPasswordResetEmail(params: {
  email: string;
  token: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?email=${encodeURIComponent(
    params.email,
  )}&token=${encodeURIComponent(params.token)}`;

  await sendMail({
    to: params.email,
    subject: "重置你的 Speech Interpreter 密码",
    text: `请在 30 分钟内打开以下链接重置密码：${resetUrl}`,
    html: `<p>请在 30 分钟内点击链接重置密码：</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  });
}

export async function sendOrganizationInvitationEmail(params: {
  email: string;
  organizationName: string;
  token: string;
  invitedByName?: string | null;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const invitationUrl = `${appUrl}/invitations/${encodeURIComponent(params.token)}`;
  const inviter = params.invitedByName ? `${params.invitedByName} 邀请你` : "你被邀请";

  await sendMail({
    to: params.email,
    subject: `加入 ${params.organizationName}`,
    text: `${inviter}加入 ${params.organizationName}。请在 24 小时内打开以下链接接受邀请：${invitationUrl}`,
    html: `<p>${inviter}加入 <strong>${params.organizationName}</strong>。</p><p>请在 24 小时内点击链接接受邀请：</p><p><a href="${invitationUrl}">${invitationUrl}</a></p>`,
  });
}
