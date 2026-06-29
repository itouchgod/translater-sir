import { PrismaClient, UserRole, MemberRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const defaultTerms = [
  {
    source: "同声传译",
    target: "simultaneous interpretation",
    language: "zh-en",
    notes: "平台核心能力",
  },
  {
    source: "实时字幕",
    target: "real-time captions",
    language: "zh-en",
    notes: "会议字幕展示",
  },
  {
    source: "术语库",
    target: "terminology glossary",
    language: "zh-en",
    notes: "企业自定义术语",
  },
  {
    source: "会议纪要",
    target: "meeting summary",
    language: "zh-en",
    notes: "AI 自动生成摘要",
  },
  {
    source: "语音识别",
    target: "speech recognition",
    language: "zh-en",
    notes: "ASR 服务",
  },
];

async function main() {
  const passwordHash = await hash("Admin123456!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      name: "超级管理员",
      passwordHash,
      role: UserRole.SUPER_ADMIN,
    },
    create: {
      email: "admin@example.com",
      name: "超级管理员",
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      emailVerified: new Date(),
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: "example-corp" },
    update: {
      name: "示例公司",
    },
    create: {
      name: "示例公司",
      slug: "example-corp",
    },
  });

  await prisma.member.upsert({
    where: {
      userId_organizationId: {
        userId: admin.id,
        organizationId: organization.id,
      },
    },
    update: {
      role: MemberRole.OWNER,
    },
    create: {
      userId: admin.id,
      organizationId: organization.id,
      role: MemberRole.OWNER,
    },
  });

  const dictionary =
    (await prisma.dictionary.findFirst({
      where: {
        organizationId: organization.id,
        isDefault: true,
      },
    })) ??
    (await prisma.dictionary.create({
      data: {
        organizationId: organization.id,
        name: "默认术语库",
        description: "示例公司默认中英术语库",
        isDefault: true,
      },
    }));

  await prisma.dictionaryTerm.deleteMany({
    where: {
      dictionaryId: dictionary.id,
    },
  });

  await prisma.dictionaryTerm.createMany({
    data: defaultTerms.map((term) => ({
      dictionaryId: dictionary.id,
      ...term,
    })),
  });

  console.info("Seed completed: admin@example.com / 示例公司 / 默认术语库");
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
