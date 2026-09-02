import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Star } from "lucide-react";

import { AppShell, useMe } from "@/components/AppShell";
import { Panel, Td, Th } from "@/components/trading-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTick } from "@/hooks/useTick";
import { useTradingState } from "@/hooks/useTradingState";
import { num, pct } from "@/lib/format";
import { CATEGORY_LABELS, quoteFor, type InstrumentCategory } from "@/lib/market-sim";
import { toggleWatchlist } from "@/lib/account.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/markets")({
  head: () => ({
    meta: [
      { title: "Markets — TradeX simulated prices" },
      {
        name: "description",
        content: "Browse simulated forex, stock, crypto, index and commodity markets with live-feel quotes.",
      },
      { property: "og:title", content: "TradeX markets overview" },
      { property: "og:description", content: "Thirty simulated instruments across five asset classes." },
    ],
  }),
  component: MarketsPage,
});

const CATEGORIES = ["all", "forex", "stocks", "crypto", "indices", "commodities"] as const;

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
    <AppShell title="Markets" subtitle="Simulated quotes across five asset classes">
      <Panel
        action={
          <Input
            placeholder="Search markets"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-44"
          />
        }
        title="Instruments"
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full border border-border px-3 py-1 text-xs font-medium capitalize",
                c === category ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {c === "all" ? "All" : CATEGORY_LABELS[c as InstrumentCategory]}
            </button>
          ))}
        </div>

        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-160 border-collapse">
            <thead>
              <tr className="border-b border-border text-left">
                <Th>Symbol</Th>
                <Th>Market</Th>
                <Th right>Bid</Th>
                <Th right>Ask</Th>
                <Th right>Spread</Th>
                <Th right>24h</Th>
                <Th right>Trade</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const q = quoteFor(i, now || 0);
                const watching = watchlist.includes(i.symbol);
                return (
                  <tr key={i.symbol} className="border-b border-border/60 last:border-0">
                    <Td>
                      <div className="flex items-center gap-2">
                        <button
                          aria-label={watching ? `Remove ${i.symbol} from watchlist` : `Add ${i.symbol} to watchlist`}
                          onClick={async () => {
                            await watchFn({ data: { symbol: i.symbol } });
                            await queryClient.invalidateQueries({ queryKey: ["me"] });
                          }}
                        >
                          <Star className={cn("size-3.5", watching ? "fill-amber text-amber" : "text-muted-foreground")} />
                        </button>
                        <span className="font-medium">{i.symbol}</span>
                        {!i.is_tradable && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                            closed
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span className="text-muted-foreground">{i.name}</span>
                    </Td>
                    <Td right>
                      <span className="num">{num(q.bid, i.digits)}</span>
                    </Td>
                    <Td right>
                      <span className="num">{num(q.ask, i.digits)}</span>
                    </Td>
                    <Td right>
                      <span className="num text-xs text-muted-foreground">{num(q.ask - q.bid, i.digits)}</span>
                    </Td>
                    <Td right>
                      <span className={cn("num font-medium", q.changePct >= 0 ? "text-up" : "text-down")}>
                        {q.changePct >= 0 ? "+" : ""}
                        {pct(q.changePct)}
                      </span>
                    </Td>
                    <Td right>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/terminal">Trade</Link>
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
