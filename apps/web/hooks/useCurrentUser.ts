"use client";

import useSWR from "swr";

type ApiError = {
  code: string;
  message: string;
};

export type CurrentUserResponse = {
  id: string;
  email: string;
  emailVerified: string | null;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  memberships: Array<{
    id: string;
    role: string;
    joinedAt: string;
    organization: {
      id: string;
      name: string;
      slug: string;
      logoUrl: string | null;
      plan: string;
    };
  }>;
};

async function fetchCurrentUser(url: string) {
  const response = await fetch(url);
  const payload = (await response.json()) as {
    data: CurrentUserResponse | null;
    error: ApiError | null;
  };

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? "获取当前用户失败");
  }

  return payload.data;
}

export function useCurrentUser() {
  return useSWR("/api/users/me", fetchCurrentUser);
}
