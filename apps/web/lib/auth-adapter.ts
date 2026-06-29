import { PrismaAdapter } from "@auth/prisma-adapter";
import type { PrismaClient, User as PrismaUser } from "@prisma/client";
import type { Adapter, AdapterUser } from "next-auth/adapters";

function toAdapterUser(user: PrismaUser): AdapterUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.name,
    image: user.avatarUrl,
  };
}

function mapAdapterInput(data: Partial<AdapterUser>) {
  return {
    email: data.email,
    emailVerified: data.emailVerified,
    name: data.name,
    avatarUrl: data.image,
  };
}

export function AuthPrismaAdapter(prisma: PrismaClient): Adapter {
  const baseAdapter = PrismaAdapter(prisma);

  return {
    ...baseAdapter,
    async createUser(data) {
      const user = await prisma.user.create({
        data: {
          email: data.email,
          emailVerified: data.emailVerified,
          name: data.name,
          avatarUrl: data.image,
        },
      });

      return toAdapterUser(user);
    },
    async getUser(id) {
      const user = await prisma.user.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });
      return user ? toAdapterUser(user) : null;
    },
    async getUserByEmail(email) {
      const user = await prisma.user.findFirst({
        where: {
          email,
          deletedAt: null,
        },
      });
      return user ? toAdapterUser(user) : null;
    },
    async getUserByAccount(providerAccountId) {
      const account = await prisma.account.findUnique({
        where: { provider_providerAccountId: providerAccountId },
        include: { user: true },
      });

      if (!account?.user || account.user.deletedAt) {
        return null;
      }

      return toAdapterUser(account.user);
    },
    async updateUser(data) {
      const user = await prisma.user.update({
        where: { id: data.id },
        data: mapAdapterInput(data),
      });

      return toAdapterUser(user);
    },
    async deleteUser(id) {
      const user = await prisma.user.delete({ where: { id } });
      return toAdapterUser(user);
    },
    async getSessionAndUser(sessionToken) {
      const result = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      });

      if (!result) {
        return null;
      }

      const { user, ...session } = result;
      return {
        session,
        user: toAdapterUser(user),
      };
    },
  };
}
