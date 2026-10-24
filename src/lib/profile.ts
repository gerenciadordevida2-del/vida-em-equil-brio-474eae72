import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  preferences: Record<string, unknown>;
};

/** RLS limits every read/write to the signed-in user's own row. */
export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, preferences")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
    staleTime: 60_000,
  });

/** Profile name first, then the Google session name, then the e-mail prefix. */
export function displayNameOf(profile: Profile | null | undefined, user: Pick<User, "email" | "user_metadata">) {
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  return (
    profile?.display_name?.trim() ||
    meta.full_name?.trim() ||
    meta.name?.trim() ||
    user.email?.split("@")[0] ||
    ""
  );
}

export function avatarOf(profile: Profile | null | undefined, user: Pick<User, "user_metadata">) {
  const meta = (user.user_metadata ?? {}) as { avatar_url?: string; picture?: string };
  return profile?.avatar_url || meta.avatar_url || meta.picture || null;
}

export function useProfile(user: User) {
  return useQuery(profileQuery(user.id));
}

export function useUpdateProfile(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { display_name?: string; preferences?: Record<string, unknown> }) => {
      const name = patch.display_name?.trim();
      if (name !== undefined && (name.length === 0 || name.length > 80))
        throw new Error("O nome deve ter entre 1 e 80 caracteres.");
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, ...patch, ...(name !== undefined ? { display_name: name } : {}) } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", userId] }),
  });
}
