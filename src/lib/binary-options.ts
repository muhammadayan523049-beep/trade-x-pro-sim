/** Shared, client-safe config for binary (up/down) options. */

export interface BinaryDuration {
  key: string;
  label: string;
  seconds: number;
  /** Payout rate on a winning trade, e.g. 0.85 = +85% of stake. */
  rate: number;
}

export const BINARY_DURATIONS: BinaryDuration[] = [
  { key: "30s", label: "30 sec", seconds: 30, rate: 0.75 },
  { key: "1m", label: "1 min", seconds: 60, rate: 0.8 },
  { key: "3m", label: "3 min", seconds: 180, rate: 0.83 },
  { key: "5m", label: "5 min", seconds: 300, rate: 0.85 },
  { key: "15m", label: "15 min", seconds: 900, rate: 0.88 },
  { key: "1h", label: "1 hour", seconds: 3600, rate: 0.9 },
];

export const MIN_STAKE = 1;
export const MAX_STAKE = 100_000;

export interface BinaryTradeRow {
  id: string;
  account_id: string;
  symbol: string;
  direction: "up" | "down";
  stake: number;
  payout_rate: number;
  duration_seconds: number;
  entry_price: number;
  expiry_price: number | null;
  payout: number | null;
  status: "open" | "won" | "lost" | "tie";
  opened_at: string;
  expires_at: string;
  settled_at: string | null;
}

export function durationFor(seconds: number): BinaryDuration | undefined {
  return BINARY_DURATIONS.find((d) => d.seconds === seconds);
}

export function secondsLeft(trade: BinaryTradeRow, now: number): number {
  return Math.max(0, Math.round((Date.parse(trade.expires_at) - now) / 1000));
}

export function countdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
