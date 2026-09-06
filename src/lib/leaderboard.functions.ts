import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface LeaderRow {
  userId: string;
  name: string;
  trades: number;
  wins: number;
  winRate: number;
  profit: number;
  volume: number;
}

const PERIODS = { day: 1, week: 7, month: 30, all: 3650 } as const;
export type LeaderboardPeriod = keyof typeof PERIODS;

/** Top traders by settled binary profit — aggregated across all accounts. */
export const getLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ period: z.enum(["day", "week", "month", "all"]).default("week") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - PERIODS[data.period] * 86400_000).toISOString();

    const { data: trades } = await supabaseAdmin
      .from("binary_trades")
      .select("user_id,stake,payout,status,settled_at")
      .neq("status", "open")
      .gte("settled_at", since)
      .limit(5000);

    const { data: profiles } = await supabaseAdmin.from("profiles").select("id,full_name,email");
    const nameById = new Map<string, string>();
    for (const p of (profiles ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
      const raw = p.full_name?.trim() || (p.email ?? "").split("@")[0] || "Trader";
      nameById.set(p.id, raw);
    }

    const agg = new Map<string, LeaderRow>();
    for (const t of (trades ?? []) as {
      user_id: string;
      stake: number;
      payout: number | null;
      status: string;
    }[]) {
      const row =
        agg.get(t.user_id) ??
        ({
          userId: t.user_id,
          name: nameById.get(t.user_id) ?? "Trader",
          trades: 0,
          wins: 0,
          winRate: 0,
          profit: 0,
          volume: 0,
        } satisfies LeaderRow);
      row.trades += 1;
      if (t.status === "won") row.wins += 1;
      row.profit += Number(t.payout ?? 0) - Number(t.stake);
      row.volume += Number(t.stake);
      agg.set(t.user_id, row);
    }

    const rows = [...agg.values()]
      .map((r) => ({ ...r, winRate: r.trades ? (r.wins / r.trades) * 100 : 0 }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 50);

    return { rows, meId: context.userId as string };
  });
