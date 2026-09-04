import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { ClosedTable, MetricCard, Panel, PositionsTable } from "@/components/trading-ui";
import { useTick } from "@/hooks/useTick";
import { useTradingState } from "@/hooks/useTradingState";
import { money, num, pct, signedMoney } from "@/lib/format";
import { indexBySymbol } from "@/lib/instrument-utils";
import { accountMetrics, enrichPosition, type PositionRow } from "@/lib/trading-engine";
import { closePosition } from "@/lib/trading.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — TradeX" },
      { name: "description", content: "Review open exposure, realised results and allocation across your simulated accounts." },
      { property: "og:title", content: "TradeX portfolio" },
      { property: "og:description", content: "Exposure, allocation and realised performance for paper trading." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const { data: state } = useTradingState(accountId);
  const now = useTick(1000);
  const queryClient = useQueryClient();
  const close = useServerFn(closePosition);

  const bySymbol = useMemo(() => indexBySymbol(state?.instruments ?? []), [state?.instruments]);
  const account = (state?.accounts ?? []).find((a) => a.id === (accountId ?? state?.activeAccountId));
  const open = useMemo(
    () => ((state?.positions ?? []) as PositionRow[]).map((p) => enrichPosition(p, bySymbol[p.symbol], now || 0)),
    [state?.positions, bySymbol, now],
  );
  const closed = (state?.closed ?? []) as PositionRow[];
  const metrics = accountMetrics(Number(account?.balance ?? 0), open, closed);

  const allocation = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const p of open) {
      const cat = bySymbol[p.symbol]?.category ?? "other";
      totals[cat] = (totals[cat] ?? 0) + p.notional;
    }
    const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(totals).map(([k, v]) => ({ key: k, value: v, share: (v / sum) * 100 }));
  }, [open, bySymbol]);

  const wins = closed.filter((p) => Number(p.realized_pl ?? 0) > 0).length;

  return (
    <AppShell title="Portfolio" subtitle="Exposure, allocation and realised performance">
      <div className="mb-4 flex flex-wrap gap-2">
        {(state?.accounts ?? []).map((a) => (
          <button
            key={a.id}
            onClick={() => setAccountId(a.id)}
            className={cn(
              "rounded-full border border-border px-3 py-1 text-xs font-medium capitalize",
              a.id === account?.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {a.type}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Equity" value={money(metrics.equity)} />
        <MetricCard
          label="Unrealised P/L"
          value={signedMoney(metrics.unrealized)}
          tone={metrics.unrealized >= 0 ? "up" : "down"}
        />
        <MetricCard
          label="Realised P/L"
          value={signedMoney(metrics.realized)}
          tone={metrics.realized >= 0 ? "up" : "down"}
        />
        <MetricCard
          label="Win rate"
          value={closed.length ? `${num((wins / closed.length) * 100, 1)}%` : "—"}
          hint={`${closed.length} closed trades`}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Panel title="Open positions">
            <PositionsTable
              positions={open}
              digitsFor={(s) => bySymbol[s]?.digits ?? 2}
              onClose={async (id) => {
                try {
                  await close({ data: { positionId: id } });
                  toast.success("Position closed (simulated).");
                  await queryClient.invalidateQueries();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not close position");
                }
              }}
            />
          </Panel>
          <Panel title="Trade history">
            <ClosedTable rows={closed} digitsFor={(s) => bySymbol[s]?.digits ?? 2} />
          </Panel>
        </div>

        <Panel title="Allocation">
          {allocation.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open exposure.</p>
          ) : (
            <ul className="space-y-3">
              {allocation.map((a) => (
                <li key={a.key}>
                  <div className="flex items-center justify-between text-sm capitalize">
                    <span>{a.key}</span>
                    <span className="num text-muted-foreground">{pct(a.share)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${a.share}%` }} />
                  </div>
                  <p className="num mt-1 text-xs text-muted-foreground">{money(a.value)} notional</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
