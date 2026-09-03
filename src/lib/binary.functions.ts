import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { indexBySymbol, toInstruments } from "./instrument-utils";
import { priceAt, quoteFor, roundTo, type Instrument } from "./market-sim";
import { BINARY_DURATIONS, MAX_STAKE, MIN_STAKE, type BinaryTradeRow } from "./binary-options";

/** Settle every expired binary trade for the user, crediting winning payouts. */
async function settleDue(supabase: SupabaseClient, userId: string, bySymbol: Record<string, Instrument>) {
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("binary_trades")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "open")
    .lte("expires_at", nowIso);

  const due = (data ?? []) as BinaryTradeRow[];
  if (due.length === 0) return;

  const credits: Record<string, number> = {};

  for (const trade of due) {
    const inst = bySymbol[trade.symbol];
    if (!inst) continue;
    const expiryMs = Date.parse(trade.expires_at);
    const expiryPrice = roundTo(priceAt(inst, expiryMs), inst.digits);
    const entry = Number(trade.entry_price);

    let status: "won" | "lost" | "tie";
    if (expiryPrice === entry) status = "tie";
    else if (trade.direction === "up") status = expiryPrice > entry ? "won" : "lost";
    else status = expiryPrice < entry ? "won" : "lost";

    const stake = Number(trade.stake);
    const payout = status === "won" ? stake * (1 + Number(trade.payout_rate)) : status === "tie" ? stake : 0;

    await supabase
      .from("binary_trades")
      .update({ status, expiry_price: expiryPrice, payout, settled_at: nowIso })
      .eq("id", trade.id)
      .eq("status", "open");

    if (payout > 0) {
      credits[trade.account_id] = (credits[trade.account_id] ?? 0) + payout;
      await supabase.from("transactions").insert({
        user_id: userId,
        account_id: trade.account_id,
        type: "trade",
        amount: payout,
        status: "completed",
        method: "binary",
        reference: trade.id,
        note: `Binary ${trade.direction.toUpperCase()} ${trade.symbol} — ${status}`,
      });
    }

    await supabase.from("notifications").insert({
      user_id: userId,
      title: `Binary trade ${status}`,
      body: `${trade.symbol} ${trade.direction.toUpperCase()} settled at ${expiryPrice} (entry ${entry}).`,
    });
  }

  for (const [accountId, amount] of Object.entries(credits)) {
    const { data: acct } = await supabase.from("accounts").select("balance").eq("id", accountId).maybeSingle();
    if (!acct) continue;
    await supabase
      .from("accounts")
      .update({ balance: Number((acct as { balance: number }).balance) + amount })
      .eq("id", accountId);
  }
}

export const getBinaryState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ accountId: z.string().uuid().nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    const userId = context.userId;

    const { data: instRows } = await supabase.from("instruments").select("*").order("symbol");
    const instruments = toInstruments(instRows as Record<string, unknown>[] | null);
    const bySymbol = indexBySymbol(instruments);

    await settleDue(supabase, userId, bySymbol);

    const { data: accounts } = await supabase.from("accounts").select("*").eq("user_id", userId).order("type");
    const accountList = (accounts ?? []) as { id: string; type: string; balance: number; leverage: number }[];
    const active = accountList.find((a) => a.id === data.accountId) ?? accountList[0] ?? null;

    let trades: BinaryTradeRow[] = [];
    if (active) {
      const { data: rows } = await supabase
        .from("binary_trades")
        .select("*")
        .eq("account_id", active.id)
        .order("created_at", { ascending: false })
        .limit(100);
      trades = (rows ?? []) as BinaryTradeRow[];
    }

    return {
      instruments,
      accounts: accountList,
      activeAccountId: active?.id ?? null,
      open: trades.filter((t) => t.status === "open"),
      settled: trades.filter((t) => t.status !== "open"),
    };
  });

export const placeBinaryTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        accountId: z.string().uuid(),
        symbol: z.string().trim().min(1).max(20),
        direction: z.enum(["up", "down"]),
        stake: z.number().min(MIN_STAKE).max(MAX_STAKE),
        durationSeconds: z.number().int().positive(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    const userId = context.userId;

    const duration = BINARY_DURATIONS.find((d) => d.seconds === data.durationSeconds);
    if (!duration) throw new Error("Unsupported expiry.");

    const { data: instRow } = await supabase
      .from("instruments")
      .select("*")
      .eq("symbol", data.symbol)
      .maybeSingle();
    if (!instRow) throw new Error("Unknown instrument.");
    const inst = toInstruments([instRow as Record<string, unknown>])[0]!;
    if (!inst.is_tradable) throw new Error("This instrument is not tradable right now.");

    const { data: account } = await supabase
      .from("accounts")
      .select("id,balance")
      .eq("id", data.accountId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!account) throw new Error("Account not found.");
    const acct = account as { id: string; balance: number };
    if (data.stake > Number(acct.balance)) throw new Error("Stake exceeds your balance.");

    const now = Date.now();
    const quote = quoteFor(inst, now);
    const entry = data.direction === "up" ? quote.ask : quote.bid;

    const { data: inserted, error } = await supabase
      .from("binary_trades")
      .insert({
        user_id: userId,
        account_id: acct.id,
        symbol: inst.symbol,
        direction: data.direction,
        stake: data.stake,
        payout_rate: duration.rate,
        duration_seconds: duration.seconds,
        entry_price: entry,
        opened_at: new Date(now).toISOString(),
        expires_at: new Date(now + duration.seconds * 1000).toISOString(),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Stake leaves the balance immediately; payout is credited at expiry.
    await supabase
      .from("accounts")
      .update({ balance: Number(acct.balance) - data.stake })
      .eq("id", acct.id);

    await supabase.from("transactions").insert({
      user_id: userId,
      account_id: acct.id,
      type: "trade",
      amount: -Math.abs(data.stake),
      status: "completed",
      method: "binary",
      reference: (inserted as { id: string }).id,
      note: `Binary ${data.direction.toUpperCase()} ${inst.symbol} · ${duration.label} expiry`,
    });

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "binary.place",
      entity: "binary_trades",
      entity_id: (inserted as { id: string }).id,
      meta: { symbol: inst.symbol, direction: data.direction, stake: data.stake, seconds: duration.seconds },
    });

    return inserted as BinaryTradeRow;
  });
