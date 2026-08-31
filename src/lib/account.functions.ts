import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profileRes, rolesRes, accountsRes, kycRes, notifRes, watchRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("accounts").select("*").eq("user_id", userId).order("type"),
      supabase.from("kyc_submissions").select("status,review_note,submitted_at,reviewed_at").eq("user_id", userId).maybeSingle(),
      supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("watchlist_items").select("symbol").eq("user_id", userId).order("created_at"),
    ]);

    return {
      profile: profileRes.data,
      roles: (rolesRes.data ?? []).map((r) => r.role as string),
      isAdmin: (rolesRes.data ?? []).some((r) => r.role === "admin"),
      accounts: accountsRes.data ?? [],
      kyc: kycRes.data,
      notifications: notifRes.data ?? [],
      watchlist: (watchRes.data ?? []).map((w) => w.symbol as string),
    };
  });

const profileSchema = z.object({
  full_name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  language: z.enum(["en", "ur", "es", "fr", "de", "ar"]).optional(),
  theme: z.enum(["light", "cream", "contrast"]).optional(),
  two_factor_enabled: z.boolean().optional(),
  notify_email: z.boolean().optional(),
  notify_push: z.boolean().optional(),
  notify_trade_alerts: z.boolean().optional(),
  default_lots: z.number().min(0.01).max(100).optional(),
  default_leverage: z.number().int().min(1).max(500).optional(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "profile.update",
      entity: "profiles",
      entity_id: userId,
      meta: JSON.parse(JSON.stringify(patch)),
    });
    return { ok: true };
  });

export const toggleWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ symbol: z.string().trim().min(1).max(20) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const existing = await supabase
      .from("watchlist_items")
      .select("id")
      .eq("user_id", userId)
      .eq("symbol", data.symbol)
      .maybeSingle();

    if (existing.data) {
      await supabase.from("watchlist_items").delete().eq("id", existing.data.id);
      return { watching: false };
    }
    const { error } = await supabase.from("watchlist_items").insert({ user_id: userId, symbol: data.symbol });
    if (error) throw new Error(error.message);
    return { watching: true };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    return { ok: true };
  });
