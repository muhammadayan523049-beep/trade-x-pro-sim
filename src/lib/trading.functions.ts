import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { indexBySymbol, toInstruments } from "./instrument-utils";
import { executionPrice, marginRequired } from "./market-sim";
import { validateProtective, type PositionRow } from "./trading-engine";
import { closePositionRow, currentPriceFor, runEngine } from "./trading-sync";

const orderSchema = z.object({
  accountId: z.string().uuid(),
  symbol: z.string().trim().min(1).max(20),
  side: z.enum(["buy", "sell"]),
  kind: z.enum(["market", "limit", "stop"]),
  quantity: z.number().min(0.01).max(500),
  limitPrice: z.number().positive().nullable().optional(),
  stopPrice: z.number().positive().nullable().optional(),
  stopLoss: z.number().positive().nullable().optional(),
  takeProfit: z.number().positive().nullable().optional(),
});

export const getTradingState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ accountId: z.string().uuid().nullable().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    const userId = context.userId;

    const { data: instRows } = await supabase.from("instruments").select("*").order("symbol");
    const instruments = toInstruments(instRows as Record<string, unknown>[] | null);
    const bySymbol = indexBySymbol(instruments);

    await runEngine(supabase, userId, bySymbol);

    const { data: accounts } = await supabase.from("accounts").select("*").eq("user_id", userId).order("type");
    const accountList = (accounts ?? []) as { id: string; type: string; balance: number; leverage: number }[];
    const active = accountList.find((a) => a.id === data.accountId) ?? accountList[0] ?? null;

    if (!active) {
      return { instruments, accounts: accountList, activeAccountId: null, positions: [], closed: [], orders: [], transactions: [] };
    }

    const [positionsRes, ordersRes, txRes] = await Promise.all([
      supabase.from("positions").select("*").eq("account_id", active.id).order("opened_at", { ascending: false }),
      supabase.from("orders").select("*").eq("account_id", active.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("transactions").select("*").eq("account_id", active.id).order("created_at", { ascending: false }).limit(50),
    ]);

    const allPositions = (positionsRes.data ?? []) as PositionRow[];

    return {
      instruments,
      accounts: accountList,
      activeAccountId: active.id,
      positions: allPositions.filter((p) => p.status === "open"),
      closed: allPositions.filter((p) => p.status === "closed"),
      orders: ordersRes.data ?? [],
      transactions: txRes.data ?? [],
    };
  });

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    const userId = context.userId;

    const { data: instRow } = await supabase.from("instruments").select("*").eq("symbol", data.symbol).maybeSingle();
    if (!instRow) throw new Error("Unknown symbol.");
    const inst = toInstruments([instRow as Record<string, unknown>])[0]!;
    if (!inst.is_tradable) throw new Error(`${inst.symbol} is currently closed for trading.`);

    const { data: account } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", data.accountId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!account) throw new Error("Account not found.");
    const acct = account as { id: string; balance: number; leverage: number };

    if (data.kind === "limit" && !data.limitPrice) throw new Error("A limit price is required for limit orders.");
    if (data.kind === "stop" && !data.stopPrice) throw new Error("A stop price is required for stop orders.");

    const reference =
      data.kind === "market"
        ? executionPrice(inst, data.side)
        : Number(data.kind === "limit" ? data.limitPrice : data.stopPrice);

    const protectiveError = validateProtective(
      data.side,
      reference,
      data.stopLoss ?? null,
      data.takeProfit ?? null,
    );
    if (protectiveError) throw new Error(protectiveError);

    const margin = marginRequired(inst, data.quantity, reference, acct.leverage);

    // Free margin check against equity of open positions.
    const { data: openRows } = await supabase
      .from("positions")
      .select("margin")
      .eq("account_id", acct.id)
      .eq("status", "open");
    const usedMargin = (openRows ?? []).reduce(
      (sum: number, r) => sum + Number((r as { margin?: number }).margin ?? 0),
      0,
    );
    if (margin + usedMargin > Number(acct.balance)) {
      throw new Error("Insufficient free margin for this order size.");
    }

    const isMarket = data.kind === "market";
    const { data: inserted, error } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        account_id: acct.id,
        symbol: inst.symbol,
        side: data.side,
        kind: data.kind,
        quantity: data.quantity,
        limit_price: data.limitPrice ?? null,
        stop_price: data.stopPrice ?? null,
        stop_loss: data.stopLoss ?? null,
        take_profit: data.takeProfit ?? null,
        status: isMarket ? "filled" : "pending",
        filled_price: isMarket ? reference : null,
        filled_at: isMarket ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (isMarket) {
      await supabase.from("positions").insert({
        user_id: userId,
        account_id: acct.id,
        order_id: (inserted as { id: string }).id,
        symbol: inst.symbol,
        side: data.side,
        quantity: data.quantity,
        entry_price: reference,
        stop_loss: data.stopLoss ?? null,
        take_profit: data.takeProfit ?? null,
        margin,
        status: "open",
      });
    }

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: isMarket ? "order.fill" : "order.create",
      entity: "orders",
      entity_id: (inserted as { id: string }).id,
      meta: { symbol: inst.symbol, side: data.side, kind: data.kind, quantity: data.quantity, price: reference },
    });

    return { ok: true, orderId: (inserted as { id: string }).id, price: reference, margin, simulated: true };
  });

export const closePosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ positionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    const userId = context.userId;

    const { data: row } = await supabase
      .from("positions")
      .select("*")
      .eq("id", data.positionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) throw new Error("Position not found.");
    const pos = row as PositionRow;
    if (pos.status !== "open") throw new Error("Position is already closed.");

    const { data: instRow } = await supabase.from("instruments").select("*").eq("symbol", pos.symbol).maybeSingle();
    if (!instRow) throw new Error("Unknown symbol.");
    const inst = toInstruments([instRow as Record<string, unknown>])[0]!;

    const price = currentPriceFor(inst, pos.side);
    const diff = pos.side === "buy" ? price - Number(pos.entry_price) : Number(pos.entry_price) - price;
    const realized = diff * Number(pos.quantity) * inst.contract_size;

    await closePositionRow(supabase, userId, pos, price, realized, "manual");
    return { ok: true, price, realized };
  });

export const modifyPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        positionId: z.string().uuid(),
        stopLoss: z.number().positive().nullable(),
        takeProfit: z.number().positive().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    const userId = context.userId;

    const { data: row } = await supabase
      .from("positions")
      .select("*")
      .eq("id", data.positionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) throw new Error("Position not found.");
    const pos = row as PositionRow;

    const error = validateProtective(pos.side, Number(pos.entry_price), data.stopLoss, data.takeProfit);
    if (error) throw new Error(error);

    await supabase
      .from("positions")
      .update({ stop_loss: data.stopLoss, take_profit: data.takeProfit })
      .eq("id", pos.id);

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "position.modify",
      entity: "positions",
      entity_id: pos.id,
      meta: { stopLoss: data.stopLoss, takeProfit: data.takeProfit },
    });

    return { ok: true };
  });

export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    const userId = context.userId;

    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "order.cancel",
      entity: "orders",
      entity_id: data.orderId,
      meta: {},
    });
    return { ok: true };
  });
