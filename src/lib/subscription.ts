import { useQuery } from "@tanstack/react-query";
import { data as db } from "@/lib/fdb";
import { useAuth } from "@/lib/auth";

export type Subscription = {
  id: string;
  user_id: string;
  status: string | null;
  expires_at: string | null;
};

const isLive = (s: Subscription | null | undefined) =>
  !!s &&
  (s.status ?? "").toLowerCase() === "active" &&
  (!s.expires_at || new Date(s.expires_at).getTime() > Date.now());

/** Active-subscription state for the signed-in viewer. */
export function useSubscription() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const q = useQuery({
    queryKey: ["my-subscription", userId],
    enabled: !!userId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await db
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const row = (data as Subscription | null) ?? null;
      // Flip a lapsed subscription to expired so every surface agrees.
      if (
        row &&
        (row.status ?? "").toLowerCase() === "active" &&
        row.expires_at &&
        new Date(row.expires_at).getTime() <= Date.now()
      ) {
        await db.from("subscriptions").update({ status: "expired" }).eq("id", row.id);
        return { ...row, status: "expired" };
      }
      return row;
    },
  });

  return {
    signedIn: !!userId,
    subscription: q.data ?? null,
    isActive: isLive(q.data),
    loading: !!userId && q.isLoading,
  };
}
