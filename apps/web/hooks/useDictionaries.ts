"use client";

import useSWR from "swr";

export type DictionaryListItem = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    terms: number;
  };
};

type DictionariesResponse = {
  data: DictionaryListItem[] | null;
  error: { message: string } | null;
};

async function fetchDictionaries(url: string) {
  const response = await fetch(url);
  const payload = (await response.json()) as DictionariesResponse;

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "获取术语库失败");
  }

  return payload.data;
}

export function useDictionaries() {
  return useSWR("/api/dictionaries", fetchDictionaries);
}
