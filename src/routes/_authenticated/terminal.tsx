import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";

import { AppShell, useMe } from "@/components/AppShell";
import { CandleChart, DEFAULT_INDICATORS, type IndicatorSet } from "@/components/CandleChart";
import { OrdersTable, Panel, PositionsTable, SideTag } from "@/components/trading-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTick } from "@/hooks/useTick";
import { useTradingState } from "@/hooks/useTradingState";
import { money, num, pct } from "@/lib/format";
import { indexBySymbol } from "@/lib/instrument-utils";
import { quoteFor, TIMEFRAMES, type TimeframeKey } from "@/lib/market-sim";
import { accountMetrics, enrichPosition, estimateOrder, type OrderRow, type PositionRow } from "@/lib/trading-engine";
import { cancelOrder, closePosition, modifyPosition, placeOrder } from "@/lib/trading.functions";
import { toggleWatchlist } from "@/lib/account.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/terminal")({
  head: () => ({
    meta: [
      { title: "Trading terminal — TradeX" },
      {
        name: "description",
        content: "Simulated trading terminal with candlestick charts, indicators and market, limit and stop orders.",
      },
      { property: "og:title", content: "TradeX trading terminal" },
      { property: "og:description", content: "Charts, indicators and a full order ticket — all paper trading." },
    ],
  }),
  component: TerminalPage,
});

function TerminalPage() {
  const { data: me } = useMe();
  const [accountId, setAccountId] = useState<string | null>(null);
  const { data: state } = useTradingState(accountId);
  const now = useTick(1000);
  const queryClient = useQueryClient();

  const submitOrder = useServerFn(placeOrder);
  const close = useServerFn(closePosition);
  const modify = useServerFn(modifyPosition);
  const cancel = useServerFn(cancelOrder);
  const watchFn = useServerFn(toggleWatchlist);

  const [symbol, setSymbol] = useState("EURUSD");
  const [timeframe, setTimeframe] = useState<TimeframeKey>("5m");
  const [indicators, setIndicators] = useState<IndicatorSet>(DEFAULT_INDICATORS);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [kind, setKind] = useState<"market" | "limit" | "stop">("market");
  const [quantity, setQuantity] = useState("0.10");
  const [trigger, setTrigger] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const instruments = state?.instruments ?? [];
  const bySymbol = useMemo(() => indexBySymbol(instruments), [instruments]);
  const inst = bySymbol[symbol] ?? instruments[0];
  const account = (state?.accounts ?? []).find((a) => a.id === (accountId ?? state?.activeAccountId));

  const open = useMemo(
    () => ((state?.positions ?? []) as PositionRow[]).map((p) => enrichPosition(p, bySymbol[p.symbol], now || 0)),
    [state?.positions, bySymbol, now],
  );
  const metrics = accountMetrics(Number(account?.balance ?? 0), open, (state?.closed ?? []) as PositionRow[]);

  const quote = inst ? quoteFor(inst, now || 0) : null;
  const estimate =
    inst && Number(quantity) > 0
      ? estimateOrder(
          inst,
          side,
          Number(quantity),
          Number(account?.leverage ?? 100),
          stopLoss ? Number(stopLoss) : null,
          takeProfit ? Number(takeProfit) : null,
          now || 0,
        )
      : null;

  const filtered = instruments.filter(
    (i) =>
      i.symbol.toLowerCase().includes(search.toLowerCase()) || i.name.toLowerCase().includes(search.toLowerCase()),
  );

  async function submit() {
    if (!inst || !account) return;
    setBusy(true);
    try {
      await submitOrder({
        data: {
          accountId: account.id,
          symbol: inst.symbol,
          side,
          kind,
          quantity: Number(quantity),
          limitPrice: kind === "limit" ? Number(trigger) : null,
          stopPrice: kind === "stop" ? Number(trigger) : null,
          stopLoss: stopLoss ? Number(stopLoss) : null,
          takeProfit: takeProfit ? Number(takeProfit) : null,
        },
      });
      toast.success(kind === "market" ? "Order filled (simulated)." : "Order placed and resting.");
      setStopLoss("");
      setTakeProfit("");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Order rejected");
    } finally {
      setBusy(false);
    }
  }

  async function onModify(position: { id: string; stop_loss: number | null; take_profit: number | null }) {
    const sl = window.prompt("New stop loss (blank to clear)", position.stop_loss ? String(position.stop_loss) : "");
    if (sl === null) return;
    const tp = window.prompt("New take profit (blank to clear)", position.take_profit ? String(position.take_profit) : "");
    if (tp === null) return;
    try {
      await modify({
        data: {
          positionId: position.id,
          stopLoss: sl.trim() ? Number(sl) : null,
          takeProfit: tp.trim() ? Number(tp) : null,
        },
      });
      toast.success("Position updated.");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update position");
    }
  }

  const watching = (me?.watchlist ?? []).includes(symbol);

  return (
    <AppShell title="Trading terminal" subtitle="Simulated execution — market, limit and stop orders">
      <div className="grid gap-4 xl:grid-cols-[240px_1fr_300px]">
        <Panel title="Instruments" className="order-2 xl:order-1">
          <Input
            placeholder="Search symbol"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3"
          />
          <ul className="max-h-120 space-y-0.5 overflow-y-auto">
            {filtered.map((i) => {
              const q = quoteFor(i, now || 0);
              return (
                <li key={i.symbol}>
                  <button
                    onClick={() => setSymbol(i.symbol)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left",
                      i.symbol === symbol ? "bg-secondary" : "hover:bg-muted",
                    )}
                  >
                    <span className="truncate text-sm font-medium">{i.symbol}</span>
                    <span className={cn("num text-xs", q.changePct >= 0 ? "text-up" : "text-down")}>
                      {num(q.mid, i.digits)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="order-1 space-y-4 xl:order-2">
          <Panel className="p-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-lg font-semibold">{inst?.symbol}</h2>
                  <button
                    aria-label="Toggle watchlist"
                    onClick={async () => {
                      await watchFn({ data: { symbol } });
                      await queryClient.invalidateQueries({ queryKey: ["me"] });
                    }}
                  >
                    <Star className={cn("size-4", watching ? "fill-amber text-amber" : "text-muted-foreground")} />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{inst?.name}</p>
              </div>
              {quote && inst && (
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Bid</p>
                    <p className="num text-sm font-medium text-down">{num(quote.bid, inst.digits)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Ask</p>
                    <p className="num text-sm font-medium text-up">{num(quote.ask, inst.digits)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">24h</p>
                    <p className={cn("num text-sm font-medium", quote.changePct >= 0 ? "text-up" : "text-down")}>
                      {quote.changePct >= 0 ? "+" : ""}
                      {pct(quote.changePct)}
                    </p>
                  </div>
                </div>
              )}
              <div className="ml-auto flex flex-wrap gap-1">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.key}
                    onClick={() => setTimeframe(tf.key)}
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-medium",
                      tf.key === timeframe ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {tf.key}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 px-4 py-2">
              {(Object.keys(indicators) as (keyof IndicatorSet)[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setIndicators({ ...indicators, [key]: !indicators[key] })}
                  className={cn(
                    "rounded-full border border-border px-2.5 py-1 text-xs capitalize",
                    indicators[key] ? "bg-secondary text-secondary-foreground" : "text-muted-foreground",
                  )}
                >
                  {key === "sma" ? "SMA 20" : key === "ema" ? "EMA" : key}
                </button>
              ))}
            </div>

            <div className="h-96 px-2 pb-3">
              {inst && <CandleChart instrument={inst} timeframe={timeframe} now={now} indicators={indicators} />}
            </div>
          </Panel>

          <Panel title="Open positions">
            <PositionsTable
              positions={open}
              digitsFor={(s) => bySymbol[s]?.digits ?? 2}
              onModify={(p) => onModify(p)}
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

          <Panel title="Orders">
            <OrdersTable
              orders={(state?.orders ?? []) as OrderRow[]}
              digitsFor={(s) => bySymbol[s]?.digits ?? 2}
              onCancel={async (id) => {
                await cancel({ data: { orderId: id } });
                toast.success("Order cancelled.");
                await queryClient.invalidateQueries();
              }}
            />
          </Panel>
        </div>

        <div className="order-3 space-y-4">
          <Panel title="Order ticket">
            <div className="mb-3 flex flex-wrap gap-2">
              {(state?.accounts ?? []).map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAccountId(a.id)}
                  className={cn(
                    "rounded-full border border-border px-2.5 py-1 text-xs font-medium capitalize",
                    a.id === account?.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {a.type}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSide("buy")}
                className={cn(
                  "rounded-lg border border-border py-2 text-sm font-semibold uppercase",
                  side === "buy" ? "bg-up text-primary-foreground" : "text-up",
                )}
              >
                Buy
              </button>
              <button
                onClick={() => setSide("sell")}
                className={cn(
                  "rounded-lg border border-border py-2 text-sm font-semibold uppercase",
                  side === "sell" ? "bg-down text-primary-foreground" : "text-down",
                )}
              >
                Sell
              </button>
            </div>

            <div className="mt-3 flex gap-1">
              {(["market", "limit", "stop"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize",
                    kind === k ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {k}
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="qty">Size (lots)</Label>
                <Input id="qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              {kind !== "market" && (
                <div className="space-y-1.5">
                  <Label htmlFor="trigger">{kind === "limit" ? "Limit price" : "Stop price"}</Label>
                  <Input id="trigger" inputMode="decimal" value={trigger} onChange={(e) => setTrigger(e.target.value)} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sl">Stop loss</Label>
                  <Input id="sl" inputMode="decimal" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tp">Take profit</Label>
                  <Input id="tp" inputMode="decimal" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} />
                </div>
              </div>
            </div>

            {estimate && (
              <dl className="mt-4 space-y-1.5 rounded-xl bg-muted p-3 text-xs">
                <Row label="Est. entry" value={num(estimate.entry, inst?.digits ?? 2)} />
                <Row label="Notional" value={money(estimate.notional)} />
                <Row label="Margin required" value={money(estimate.margin)} />
                <Row label="Risk / reward" value={estimate.ratio ? `1 : ${num(estimate.ratio, 2)}` : "—"} />
                <Row label="Free margin" value={money(metrics.freeMargin)} />
              </dl>
            )}

            <Button className="mt-4 w-full" disabled={busy || !account} onClick={submit}>
              {kind === "market" ? "Execute" : "Place"} {side} order
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Simulated execution. No real orders are routed.
            </p>
          </Panel>

          <Panel title="Position summary">
            <div className="space-y-2 text-sm">
              <Row label="Equity" value={money(metrics.equity)} />
              <Row label="Used margin" value={money(metrics.usedMargin)} />
              <Row label="Margin level" value={metrics.marginLevel ? pct(metrics.marginLevel) : "—"} />
              <Row label="Exposure" value={money(open.reduce((s, p) => s + p.notional, 0))} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {open.slice(0, 6).map((p) => (
                <span key={p.id} className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
                  {p.symbol} <SideTag side={p.side} />
                </span>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="num font-medium">{value}</span>
    </div>
  );
}
