import type { Instrument } from "./market-sim";

/** Coerce raw DB rows (numeric columns can arrive as strings) into Instruments. */
export function toInstrument(row: Record<string, unknown>): Instrument {
  return {
    id: String(row["id"]),
    symbol: String(row["symbol"]),
    name: String(row["name"]),
    category: row["category"] as Instrument["category"],
    base_price: Number(row["base_price"]),
    spread: Number(row["spread"]),
    volatility: Number(row["volatility"]),
    digits: Number(row["digits"]),
    contract_size: Number(row["contract_size"]),
    is_tradable: Boolean(row["is_tradable"]),
  };
}

export function toInstruments(rows: Record<string, unknown>[] | null): Instrument[] {
  return (rows ?? []).map(toInstrument);
}

export function indexBySymbol(list: Instrument[]): Record<string, Instrument> {
  const map: Record<string, Instrument> = {};
  for (const i of list) map[i.symbol] = i;
  return map;
}
