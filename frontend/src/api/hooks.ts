import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Topic } from "../types";
export function useTopics(userId?: number) {
  return useQuery({
    queryKey: ["topics", userId],
    queryFn: async ({ signal }) => (await api.get<Topic[]>("topics/", { signal })).data,
    enabled: userId !== undefined,
    refetchInterval: 15000,
  });
}
export function useTopicMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      path,
      data,
      method = "post",
    }: {
      path: string;
      data?: unknown;
      method?: "post" | "patch" | "delete";
    }) => method === "delete" ? (await api.delete(path)).data : (await api[method](path, data)).data,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["topics"] });
    },
  });
}
