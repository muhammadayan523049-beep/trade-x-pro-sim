/**
 * Trading service (paper / simulation).
 *
 * Pure calculation layer shared by the server functions and the UI so numbers
 * never disagree. No network, no database, no secrets.
 */
import {
  computePl,
  executionPrice,
  marginRequired,
  quoteFor,
  type Instrument,
} from "./market-sim";

export interface PositionRow {
  id: string;
  account_id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  entry_price: number;
  close_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  margin: number;
  realized_pl: number | null;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
}

export interface OrderRow {
  id: string;
  account_id: string;
  symbol: string;
  side: "buy" | "sell";
  kind: "market" | "limit" | "stop";
  quantity: number;
  limit_price: number | null;
  stop_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  status: "pending" | "filled" | "cancelled" | "rejected";
  filled_price: number | null;
  filled_at: string | null;
  created_at: string;
}

export interface EnrichedPosition extends PositionRow {
  currentPrice: number;
  pl: number;
  plPct: number;
  notional: number;
}

export interface AccountMetrics {
  balance: number;
  equity: number;
  openPl: number;
  usedMargin: number;
  freeMargin: number;
  marginLevel: number;
  todayPl: number;
  overallPl: number;
}

export function enrichPosition(
  position: PositionRow,
  inst: Instrument | undefined,
  now = Date.now(),
): EnrichedPosition {
  if (!inst) {
    return { ...position, currentPrice: position.entry_price, pl: 0, plPct: 0, notional: 0 };
  }
  const q = quoteFor(inst, now);
  const currentPrice = position.side === "buy" ? q.bid : q.ask;
  const pl = computePl(inst, position.side, position.quantity, position.entry_price, currentPrice);
  const notionalValue = position.quantity * inst.contract_size * position.entry_price;
  return {
    ...position,
    currentPrice,
    pl,
    plPct: notionalValue === 0 ? 0 : (pl / notionalValue) * 100,
    notional: notionalValue,
  };
}

export function accountMetrics(
  balance: number,
  open: EnrichedPosition[],
  closed: PositionRow[],
): AccountMetrics {
  const openPl = open.reduce((sum, p) => sum + p.pl, 0);
  const usedMargin = open.reduce((sum, p) => sum + Number(p.margin ?? 0), 0);
  const equity = balance + openPl;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const realizedToday = closed
    .filter((p) => p.closed_at && new Date(p.closed_at).getTime() >= startOfDay.getTime())
    .reduce((sum, p) => sum + Number(p.realized_pl ?? 0), 0);
  const realizedAll = closed.reduce((sum, p) => sum + Number(p.realized_pl ?? 0), 0);
  return {
    balance,
    equity,
    openPl,
    usedMargin,
    freeMargin: equity - usedMargin,
    marginLevel: usedMargin > 0 ? (equity / usedMargin) * 100 : 0,
    todayPl: realizedToday + openPl,
    overallPl: realizedAll + openPl,
  };
}

/** Should a resting order be triggered at the current price? */
export function shouldTrigger(order: OrderRow, inst: Instrument, now = Date.now()): boolean {
  const price = executionPrice(inst, order.side, now);
  if (order.kind === "limit") {
    const target = Number(order.limit_price ?? 0);
    return order.side === "buy" ? price <= target : price >= target;
  }
  if (order.kind === "stop") {
    const target = Number(order.stop_price ?? 0);
    return order.side === "buy" ? price >= target : price <= target;
  }
  return true;
}

/** Has a stop loss or take profit been hit? */
export function protectiveHit(
  position: PositionRow,
  inst: Instrument,
  now = Date.now(),
): { hit: boolean; price: number; reason: "stop_loss" | "take_profit" | null } {
  const q = quoteFor(inst, now);
  const price = position.side === "buy" ? q.bid : q.ask;
  const sl = position.stop_loss ? Number(position.stop_loss) : null;
  const tp = position.take_profit ? Number(position.take_profit) : null;
  if (position.side === "buy") {
    if (sl !== null && price <= sl) return { hit: true, price: sl, reason: "stop_loss" };
    if (tp !== null && price >= tp) return { hit: true, price: tp, reason: "take_profit" };
  } else {
    if (sl !== null && price >= sl) return { hit: true, price: sl, reason: "stop_loss" };
    if (tp !== null && price <= tp) return { hit: true, price: tp, reason: "take_profit" };
  }
  return { hit: false, price, reason: null };
}

export function estimateOrder(
  inst: Instrument,
  side: "buy" | "sell",
  quantity: number,
  leverage: number,
  stopLoss: number | null,
  takeProfit: number | null,
  now = Date.now(),
) {
  const entry = executionPrice(inst, side, now);
  const margin = marginRequired(inst, quantity, entry, leverage);
  const risk = stopLoss ? Math.abs(computePl(inst, side, quantity, entry, stopLoss)) : null;
  const reward = takeProfit ? Math.abs(computePl(inst, side, quantity, entry, takeProfit)) : null;
  return {
    entry,
    margin,
    notional: quantity * inst.contract_size * entry,
    risk,
    reward,
    ratio: risk && reward && risk > 0 ? reward / risk : null,
  };
}

export function validateProtective(
  side: "buy" | "sell",
  entry: number,
  stopLoss: number | null,
  takeProfit: number | null,
): string | null {
  if (side === "buy") {
    if (stopLoss !== null && stopLoss >= entry) return "Stop loss must be below the entry price for a buy.";
    if (takeProfit !== null && takeProfit <= entry) return "Take profit must be above the entry price for a buy.";
  } else {
    if (stopLoss !== null && stopLoss <= entry) return "Stop loss must be above the entry price for a sell.";
    if (takeProfit !== null && takeProfit >= entry) return "Take profit must be below the entry price for a sell.";
  }
  return null;
}
