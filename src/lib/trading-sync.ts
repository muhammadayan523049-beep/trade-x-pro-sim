import type { SupabaseClient } from "@supabase/supabase-js";

import { executionPrice, quoteFor, computePl, marginRequired, type Instrument } from "./market-sim";
import { protectiveHit, shouldTrigger, type OrderRow, type PositionRow } from "./trading-engine";

type Client = SupabaseClient;

interface SyncResult {
  filledOrders: number;
  closedPositions: number;
}

/**
 * Runs the paper-trading engine for one user: triggers resting limit/stop
 * orders and closes positions whose stop loss or take profit has been hit.
 * Called on every read of the trading state so the simulation stays current.
 */
export async function runEngine(
  supabase: Client,
  userId: string,
  instBySymbol: Record<string, Instrument>,
): Promise<SyncResult> {
  const now = Date.now();
  let filledOrders = 0;
  let closedPositions = 0;

  const client = supabase as unknown as SupabaseClient;

  const { data: pending } = await client
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending");

  for (const raw of (pending ?? []) as OrderRow[]) {
    const inst = instBySymbol[raw.symbol];
    if (!inst || !inst.is_tradable) continue;
    if (!shouldTrigger(raw, inst, now)) continue;

    const fill = executionPrice(inst, raw.side, now);
    const { data: account } = await client
      .from("accounts")
      .select("leverage")
      .eq("id", raw.account_id)
      .maybeSingle();
    const leverage = Number((account as { leverage?: number } | null)?.leverage ?? 100);

    await client
      .from("orders")
      .update({ status: "filled", filled_price: fill, filled_at: new Date().toISOString() })
      .eq("id", raw.id);

    await client.from("positions").insert({
      user_id: userId,
      account_id: raw.account_id,
      order_id: raw.id,
      symbol: raw.symbol,
      side: raw.side,
      quantity: raw.quantity,
      entry_price: fill,
      stop_loss: raw.stop_loss,
      take_profit: raw.take_profit,
      margin: marginRequired(inst, Number(raw.quantity), fill, leverage),
      status: "open",
    });

    await client.from("notifications").insert({
      user_id: userId,
      title: `${raw.kind === "limit" ? "Limit" : "Stop"} order filled`,
      body: `${raw.side.toUpperCase()} ${raw.quantity} ${raw.symbol} at ${fill} (simulated).`,
    });

    filledOrders += 1;
  }

  const { data: openPositions } = await client
    .from("positions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "open");

  for (const pos of (openPositions ?? []) as PositionRow[]) {
    const inst = instBySymbol[pos.symbol];
    if (!inst) continue;
    const check = protectiveHit(pos, inst, now);
    if (!check.hit) continue;

    const realized = computePl(inst, pos.side, Number(pos.quantity), Number(pos.entry_price), check.price);
    await closePositionRow(client, userId, pos, check.price, realized, check.reason ?? "auto");
    closedPositions += 1;
  }

  return { filledOrders, closedPositions };
}

export async function closePositionRow(
  supabase: SupabaseClient,
  userId: string,
  pos: PositionRow,
  price: number,
  realized: number,
  reason: string,
) {
  await supabase
    .from("positions")
    .update({
      status: "closed",
      close_price: price,
      realized_pl: realized,
      closed_at: new Date().toISOString(),
    })
    .eq("id", pos.id);

  const { data: account } = await supabase
    .from("accounts")
    .select("balance")
    .eq("id", pos.account_id)
    .maybeSingle();
  const balance = Number((account as { balance?: number } | null)?.balance ?? 0);

  await supabase
    .from("accounts")
    .update({ balance: Math.round((balance + realized) * 100) / 100 })
    .eq("id", pos.account_id);

  await supabase.from("transactions").insert({
    user_id: userId,
    account_id: pos.account_id,
    type: "trade",
    amount: Math.round(realized * 100) / 100,
    status: "completed",
    method: reason,
    reference: pos.symbol,
    note: `${pos.side.toUpperCase()} ${pos.quantity} ${pos.symbol} closed at ${price}`,
  });

  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "position.close",
    entity: "positions",
    entity_id: pos.id,
    meta: { reason, price, realized },
  });

  await supabase.from("notifications").insert({
    user_id: userId,
    title: reason === "stop_loss" ? "Stop loss triggered" : reason === "take_profit" ? "Take profit hit" : "Position closed",
    body: `${pos.symbol} closed at ${price} — simulated P/L ${realized.toFixed(2)}.`,
  });
}

export function currentPriceFor(inst: Instrument, side: "buy" | "sell", now = Date.now()): number {
  const q = quoteFor(inst, now);
  return side === "buy" ? q.bid : q.ask;
}
