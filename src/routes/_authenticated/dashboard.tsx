import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, useMe } from "@/components/AppShell";
import { MetricCard, OrdersTable, Panel, PositionsTable, TransactionsTable, type TxRow } from "@/components/trading-ui";
import { Button } from "@/components/ui/button";
import { useTick } from "@/hooks/useTick";
import { useTradingState } from "@/hooks/useTradingState";
import { money, num, pct, signedMoney } from "@/lib/format";
import { indexBySymbol } from "@/lib/instrument-utils";
import { quoteFor } from "@/lib/market-sim";
import { accountMetrics, enrichPosition, type OrderRow, type PositionRow } from "@/lib/trading-engine";
import { closePosition } from "@/lib/trading.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — TradeX simulated trading" },
      { name: "description", content: "Balance, equity, margin and live simulated P/L across your TradeX accounts." },
      { property: "og:title", content: "TradeX dashboard" },
      { property: "og:description", content: "Track equity, margin and open simulated positions in real time." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: me } = useMe();
  const [accountId, setAccountId] = useState<string | null>(null);
  const { data: state, isLoading } = useTradingState(accountId);
  const now = useTick(1000);
  const queryClient = useQueryClient();
  const close = useServerFn(closePosition);
  const [busy, setBusy] = useState<string | null>(null);

  const bySymbol = useMemo(() => indexBySymbol(state?.instruments ?? []), [state?.instruments]);
  const account = (state?.accounts ?? []).find((a) => a.id === (accountId ?? state?.activeAccountId));

  const open = useMemo(
    () => ((state?.positions ?? []) as PositionRow[]).map((p) => enrichPosition(p, bySymbol[p.symbol], now || 0)),
    [state?.positions, bySymbol, now],
  );
  const metrics = accountMetrics(Number(account?.balance ?? 0), open, (state?.closed ?? []) as PositionRow[]);
  const watch = (me?.watchlist ?? [])
    .map((s) => bySymbol[s])
    .filter((i): i is NonNullable<typeof i> => Boolean(i));

  async function onClose(id: string) {
    setBusy(id);
    try {
      await close({ data: { positionId: id } });
      toast.success("Position closed (simulated).");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not close position");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell title="Dashboard" subtitle="Simulated account overview — updates every second">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(state?.accounts ?? []).map((a) => (
          <button
            key={a.id}
            onClick={() => setAccountId(a.id)}
            className={cn(
              "rounded-full border border-border px-3.5 py-1.5 text-sm font-medium capitalize",
              a.id === account?.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {a.type} · {money(Number(a.balance))}
          </button>
        ))}
        <Button asChild size="sm" className="ml-auto">
          <Link to="/terminal">Open terminal</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Balance" value={money(metrics.balance)} hint={`Leverage 1:${account?.leverage ?? 100}`} />
        <MetricCard label="Equity" value={money(metrics.equity)} hint="Balance + floating P/L" />
        <MetricCard
          label="Open P/L"
          value={signedMoney(metrics.openPl)}
          tone={metrics.openPl >= 0 ? "up" : "down"}
          hint={`${open.length} open position${open.length === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="Free margin"
          value={money(metrics.freeMargin)}
          hint={`Used ${money(metrics.usedMargin)} · level ${metrics.marginLevel ? pct(metrics.marginLevel) : "—"}`}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Open positions" className="xl:col-span-2">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading positions…</p>
          ) : (
            <PositionsTable
              positions={open}
              digitsFor={(s) => bySymbol[s]?.digits ?? 2}
              onClose={onClose}
              busyId={busy}
            />
          )}
        </Panel>

        <Panel title="Watchlist" action={<Link to="/markets" className="text-xs underline">All markets</Link>}>
          <ul className="divide-y divide-border">
            {watch.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Watchlist empty.</li>}
            {watch.map((inst) => {
              const q = quoteFor(inst, now || 0);
              return (
                <li key={inst.symbol} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{inst.symbol}</p>
                    <p className="truncate text-xs text-muted-foreground">{inst.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="num text-sm font-medium">{num(q.mid, inst.digits)}</p>
                    <p className={cn("num text-xs", q.changePct >= 0 ? "text-up" : "text-down")}>
                      {q.changePct >= 0 ? "+" : ""}
                      {pct(q.changePct)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Recent orders">
          <OrdersTable orders={((state?.orders ?? []) as OrderRow[]).slice(0, 6)} digitsFor={(s) => bySymbol[s]?.digits ?? 2} />
        </Panel>
        <Panel title="Recent transactions">
          <TransactionsTable rows={((state?.transactions ?? []) as TxRow[]).slice(0, 6)} />
        </Panel>
      </div>
    </AppShell>
  );
}
