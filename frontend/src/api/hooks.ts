import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Identity, Topic, User } from "../types";
export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<User[]>("auth/users/")).data,
  });
}
export function useTopics(userId?: number) {
  return useQuery({
    queryKey: ["topics", userId],
    queryFn: async () => (await api.get<Topic[]>("topics/")).data,
    refetchInterval: 15000,
  });
}
export function useLogin() {
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<Identity>("auth/login/", { user_id: id })).data,
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
      method?: "post" | "patch";
    }) => (await api[method](path, data)).data,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["topics"] });
    },
  });
}
