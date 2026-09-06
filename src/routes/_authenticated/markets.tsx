import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Star } from "lucide-react";

import { AppShell, useMe } from "@/components/AppShell";
import { Panel } from "@/components/trading-ui";
import { Input } from "@/components/ui/input";
import { useTick } from "@/hooks/useTick";
import { useTradingState } from "@/hooks/useTradingState";
import { num } from "@/lib/format";
import { CATEGORY_LABELS, quoteFor, type InstrumentCategory } from "@/lib/market-sim";
import { toggleWatchlist } from "@/lib/account.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/markets")({
  head: () => ({
    meta: [
      { title: "Markets — TradeX assets and payouts" },
      {
        name: "description",
        content: "Browse forex, stock, crypto, index and commodity assets with live-feel quotes and payout rates.",
      },
      { property: "og:title", content: "TradeX markets overview" },
      { property: "og:description", content: "Thirty simulated assets across five classes, each with a payout rate." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketsPage,
});

const CATEGORIES = ["all", "forex", "stocks", "crypto", "indices", "commodities"] as const;

const PAYOUT: Record<InstrumentCategory, number> = {
  forex: 87,
  stocks: 82,
  crypto: 80,
  indices: 85,
  commodities: 78,
};

function MarketsPage() {
  const { data: me } = useMe();
  const { data: state } = useTradingState();
  const now = useTick(1000);
  const queryClient = useQueryClient();
  const watchFn = useServerFn(toggleWatchlist);

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    return (state?.instruments ?? [])
      .filter((i) => (category === "all" ? true : i.category === category))
      .filter(
        (i) =>
          i.symbol.toLowerCase().includes(search.toLowerCase()) ||
          i.name.toLowerCase().includes(search.toLowerCase()),
      );
  }, [state?.instruments, category, search]);

  const watchlist = me?.watchlist ?? [];

  return (
    <AppShell title="Markets" subtitle="Pick an asset and trade it in the trading room">
      <Panel
        title="Assets"
        action={
          <Input
            placeholder="Search assets"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-40"
          />
        }
      >
        <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold capitalize",
                c === category ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {c === "all" ? "All" : CATEGORY_LABELS[c as InstrumentCategory]}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((i) => {
            const q = quoteFor(i, now || 0);
            const watching = watchlist.includes(i.symbol);
            const up = q.changePct >= 0;
            return (
              <div
                key={i.symbol}
                className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3"
              >
                <button
                  aria-label={watching ? `Remove ${i.symbol} from watchlist` : `Add ${i.symbol} to watchlist`}
                  onClick={async () => {
                    await watchFn({ data: { symbol: i.symbol } });
                    await queryClient.invalidateQueries({ queryKey: ["me"] });
                  }}
                >
                  <Star className={cn("size-4", watching ? "fill-amber text-amber" : "text-muted-foreground")} />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{i.symbol}</span>
                    <span className="rounded-full bg-mint px-1.5 py-0.5 text-[10px] font-bold text-ink">
                      +{PAYOUT[i.category]}%
                    </span>
                    {!i.is_tradable && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                        closed
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{i.name}</p>
                </div>

                <div className="text-right">
                  <p className="num text-sm font-semibold">{num(q.mid, i.digits)}</p>
                  <p className={cn("num text-[11px] font-medium", up ? "text-up" : "text-down")}>
                    {up ? "+" : ""}
                    {num(q.changePct, 2)}%
                  </p>
                </div>

                <Link
                  to="/binary"
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
                >
                  Trade
                </Link>
              </div>
            );
          })}
        </div>
      </Panel>
    </AppShell>
  );
}
