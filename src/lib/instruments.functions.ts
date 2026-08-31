import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import { toInstruments } from "./instrument-utils";

/** Public market catalogue — readable without a session (landing page, markets page). */
export const listInstruments = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });

  const { data, error } = await client
    .from("instruments")
    .select("id,symbol,name,category,base_price,spread,volatility,digits,contract_size,is_tradable")
    .order("category")
    .order("symbol");

  if (error) throw new Error(error.message);
  return toInstruments(data as Record<string, unknown>[] | null);
});
