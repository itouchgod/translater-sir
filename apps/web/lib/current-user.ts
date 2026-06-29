import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function getCurrentSessionUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return session.user;
}

export async function requireCurrentUser() {
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    return null;
  }

  const user = await db.user.findFirst({
    where: {
      id: sessionUser.id,
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      name: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      memberships: {
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          role: true,
          joinedAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              plan: true,
            },
          },
        },
      },
    },
  });

  return user;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof requireCurrentUser>>>;
