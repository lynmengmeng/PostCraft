"use client";

import { useCallback } from "react";
import { useBackendQuery } from "@/hooks/useBackendQuery";
import { api } from "@/lib/api";
import type { ContentCategory } from "@/lib/types";

export function useContentCategories() {
  const { data, error, loading, reload, setData } = useBackendQuery(
    () => api.listContentCategories(),
    [],
  );

  const categories = data?.categories ?? [];

  const addCategory = useCallback(
    async (payload: {
      name: string;
      description?: string;
      prompt_hint?: string;
    }) => {
      const created = await api.createContentCategory(payload);
      setData((prev) => ({
        categories: [...(prev?.categories ?? []), created],
      }));
      return created;
    },
    [setData],
  );

  const removeCategory = useCallback(
    async (id: string) => {
      await api.deleteContentCategory(id);
      setData((prev) => ({
        categories: (prev?.categories ?? []).filter((c) => c.id !== id),
      }));
    },
    [setData],
  );

  const findByName = useCallback(
    (name: string): ContentCategory | undefined =>
      categories.find((c) => c.name === name),
    [categories],
  );

  return {
    categories,
    error,
    loading,
    reload,
    addCategory,
    removeCategory,
    findByName,
  };
}
