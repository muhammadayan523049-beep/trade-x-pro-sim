/**
 * Market data service (simulated).
 *
 * Deterministic, time-based price synthesis so that the browser and the server
 * always agree on the price of a symbol at a given millisecond. This module is
 * pure and isomorphic — it never touches the network or the database.
 *
 * Replace `priceAt()` with a licensed market-data provider to go live.
 */

export type InstrumentCategory = "forex" | "stocks" | "crypto" | "indices" | "commodities";

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  category: InstrumentCategory;
  base_price: number;
  spread: number;
  volatility: number;
  digits: number;
  contract_size: number;
  is_tradable: boolean;
}

export interface Quote {
  symbol: string;
  mid: number;
  bid: number;
  ask: number;
  spread: number;
  change: number;
  changePct: number;
  dayOpen: number;
  digits: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const TIMEFRAMES = [
  { key: "1m", seconds: 60 },
  { key: "5m", seconds: 300 },
  { key: "15m", seconds: 900 },
  { key: "1H", seconds: 3600 },
  { key: "4H", seconds: 14400 },
  { key: "1D", seconds: 86400 },
] as const;

export type TimeframeKey = (typeof TIMEFRAMES)[number]["key"];

function hashSymbol(symbol: string): number {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i++) {
    h ^= symbol.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100000;
}

function valueNoise(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function smoothNoise(seed: number, t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const a = valueNoise(seed + i);
  const b = valueNoise(seed + i + 1);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u - 0.5;
}

const OCTAVES = [
  { period: 45, weight: 0.35 },
  { period: 420, weight: 0.6 },
  { period: 3600, weight: 1 },
  { period: 21600, weight: 1.5 },
  { period: 86400, weight: 2.2 },
];

/** Deterministic mid price for a symbol at a point in time (ms epoch). */
export function priceAt(inst: Pick<Instrument, "symbol" | "base_price" | "volatility">, tMs: number): number {
  const seed = hashSymbol(inst.symbol);
  const seconds = tMs / 1000;
  let drift = 0;
  for (const oct of OCTAVES) {
    drift += smoothNoise(seed + oct.period, seconds / oct.period) * oct.weight;
  }
  const price = inst.base_price * (1 + drift * inst.volatility * 2.2);
  return Math.max(price, inst.base_price * 0.25);
}

export function roundTo(value: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(value * f) / f;
}

export function quoteFor(inst: Instrument, now = Date.now()): Quote {
  const mid = priceAt(inst, now);
  const dayOpen = priceAt(inst, now - 86400_000);
  const half = inst.spread / 2;
  return {
    symbol: inst.symbol,
    mid: roundTo(mid, inst.digits),
    bid: roundTo(mid - half, inst.digits),
    ask: roundTo(mid + half, inst.digits),
    spread: inst.spread,
    change: roundTo(mid - dayOpen, inst.digits),
    changePct: ((mid - dayOpen) / dayOpen) * 100,
    dayOpen: roundTo(dayOpen, inst.digits),
    digits: inst.digits,
  };
}

/** Execution price for a side, including the simulated spread. */
export function executionPrice(inst: Instrument, side: "buy" | "sell", now = Date.now()): number {
  const q = quoteFor(inst, now);
  return side === "buy" ? q.ask : q.bid;
}

export function candlesFor(inst: Instrument, timeframe: TimeframeKey, count = 90, now = Date.now()): Candle[] {
  const tf = TIMEFRAMES.find((t) => t.key === timeframe) ?? TIMEFRAMES[0];
  const stepMs = tf.seconds * 1000;
  const lastBucket = Math.floor(now / stepMs);
  const out: Candle[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const bucket = lastBucket - i;
    const start = bucket * stepMs;
    const isLast = i === 0;
    const end = isLast ? now : start + stepMs;
    const samples: number[] = [];
    const steps = 10;
    for (let s = 0; s <= steps; s++) {
      samples.push(priceAt(inst, start + ((end - start) * s) / steps));
    }
    out.push({
      time: start,
      open: roundTo(samples[0]!, inst.digits),
      close: roundTo(samples[samples.length - 1]!, inst.digits),
      high: roundTo(Math.max(...samples), inst.digits),
      low: roundTo(Math.min(...samples), inst.digits),
    });
  }
  return out;
}

/** Notional value of a position leg. */
export function notional(inst: Pick<Instrument, "contract_size">, quantity: number, price: number): number {
  return quantity * inst.contract_size * price;
}

/** Margin required for a trade at a given account leverage. */
export function marginRequired(
  inst: Pick<Instrument, "contract_size">,
  quantity: number,
  price: number,
  leverage: number,
): number {
  return notional(inst, quantity, price) / Math.max(leverage, 1);
}

/** Unrealised / realised profit & loss in account currency. */
export function computePl(
  inst: Pick<Instrument, "contract_size">,
  side: "buy" | "sell",
  quantity: number,
  entry: number,
  current: number,
): number {
  const diff = side === "buy" ? current - entry : entry - current;
  return diff * quantity * inst.contract_size;
}

export const CATEGORY_LABELS: Record<InstrumentCategory, string> = {
  forex: "Forex",
  stocks: "Stocks",
  crypto: "Crypto",
  indices: "Indices",
  commodities: "Commodities",
};
