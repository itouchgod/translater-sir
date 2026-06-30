import NextAuth, { type NextAuthResult, type User as AuthUser } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { MemberRole, UserRole } from "@prisma/client";
import { AuthPrismaAdapter } from "@/lib/auth-adapter";
import { db } from "@/lib/db";
import { isUserTokenInvalidated } from "@/lib/jwt-blacklist";
import { LoginSchema } from "@/lib/validations/auth";
import { verifyPassword } from "@/utils/password";

const SESSION_MAX_AGE_SECONDS = 15 * 60;

type CredentialsUser = AuthUser & {
  role: UserRole;
  organizationId: string | null;
};

function createOrganizationSlug(seed: string) {
  const slugBase = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const suffix = Math.random().toString(36).slice(2, 8);

  return `${slugBase || "user"}-${suffix}`;
}

async function createDefaultOrganizationForUser(user: {
  id: string;
  email: string;
  name: string | null;
}) {
  const displayName = user.name?.trim() || user.email.split("@")[0] || "用户";
  const organization = await db.organization.create({
    data: {
      name: `${displayName} 的组织`,
      slug: createOrganizationSlug(user.email),
      members: {
        create: {
          userId: user.id,
          role: MemberRole.OWNER,
        },
      },
      dictionaries: {
        create: {
          name: "默认术语库",
          description: "首次登录时自动创建的默认术语库",
          isDefault: true,
        },
      },
    },
    select: {
      id: true,
    },
  });

  return organization.id;
}

function isCredentialsUser(user: AuthUser): user is CredentialsUser {
  return Boolean(
    user.role &&
      Object.values(UserRole).includes(user.role) &&
      "organizationId" in user,
  );
}

async function getUserSessionClaims(userId: string, preferredOrganizationId?: string | null) {
  const user = await db.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      memberships: {
        orderBy: { joinedAt: "asc" },
        select: {
          organizationId: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const organizationId =
    user.memberships.find(
      (membership) => membership.organizationId === preferredOrganizationId,
    )?.organizationId ??
    user.memberships[0]?.organizationId ??
    (await createDefaultOrganizationForUser(user));

  return {
    userId: user.id,
    role: user.role,
    organizationId,
  };
}

function getRequestedOrganizationId(session: unknown) {
  if (!session || typeof session !== "object" || !("user" in session)) {
    return null;
  }

  const user = session.user;

  if (!user || typeof user !== "object" || !("organizationId" in user)) {
    return null;
  }

  const organizationId = user.organizationId;
  return typeof organizationId === "string" && organizationId.length > 0 ? organizationId : null;
}

const nextAuthResult: NextAuthResult = NextAuth({
  adapter: AuthPrismaAdapter(db),
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: 0,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const user = await db.user.findFirst({
          where: {
            email: parsed.data.email,
            deletedAt: null,
          },
          include: {
            memberships: {
              orderBy: { joinedAt: "asc" },
              take: 1,
              select: {
                organizationId: true,
              },
            },
          },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const passwordMatches = await verifyPassword(parsed.data.password, user.passwordHash);

        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          role: user.role,
          organizationId: user.memberships[0]?.organizationId ?? null,
        } satisfies CredentialsUser;
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const userId = user?.id ?? token.userId ?? token.sub;

      if (!userId) {
        return token;
      }

      if (!user && (await isUserTokenInvalidated(userId, token.iat))) {
        token.invalidated = true;
        token.userId = "";
        token.organizationId = null;
        return token;
      }

      if (trigger === "update") {
        const requestedOrganizationId = getRequestedOrganizationId(session);

        if (requestedOrganizationId) {
          const membership = await db.member.findUnique({
            where: {
              userId_organizationId: {
                userId,
                organizationId: requestedOrganizationId,
              },
            },
            select: {
              organizationId: true,
              user: {
                select: {
                  deletedAt: true,
                },
              },
            },
          });

          if (membership && !membership.user.deletedAt) {
            token.organizationId = membership.organizationId;
          }
        }

        return token;
      }

      const claims =
        user && isCredentialsUser(user)
          ? {
              userId,
              role: user.role,
              organizationId: user.organizationId,
            }
          : await getUserSessionClaims(userId, token.organizationId);

      if (!claims) {
        return token;
      }

      token.userId = claims.userId;
      token.role = claims.role;
      token.organizationId = claims.organizationId;

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.invalidated) {
          session.user.id = "";
          session.user.organizationId = null;
          return session;
        }

        session.user.id = token.userId;
        session.user.role = token.role;
        session.user.organizationId = token.organizationId;
      }

      return session;
    },
  },
});

export const handlers: NextAuthResult["handlers"] = nextAuthResult.handlers;
export const auth: NextAuthResult["auth"] = nextAuthResult.auth;
export const signIn: NextAuthResult["signIn"] = nextAuthResult.signIn;
export const signOut: NextAuthResult["signOut"] = nextAuthResult.signOut;
export const update: NextAuthResult["unstable_update"] = nextAuthResult.unstable_update;
