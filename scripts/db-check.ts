import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  const result = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
  const ok = result[0]?.ok === 1;

  if (!ok) {
    throw new Error("Database health check returned an unexpected result");
  }

  console.info("Database connection OK");
}

main()
  .catch((error: unknown) => {
    console.error("Database connection failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
