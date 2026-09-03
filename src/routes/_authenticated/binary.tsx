import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { CandleChart, DEFAULT_INDICATORS } from "@/components/CandleChart";
import { Empty, Panel, Td, Th } from "@/components/trading-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTick } from "@/hooks/useTick";
import { dateTime, money, num, signedMoney } from "@/lib/format";
import { indexBySymbol } from "@/lib/instrument-utils";
import { quoteFor } from "@/lib/market-sim";
import { BINARY_DURATIONS, countdown, secondsLeft, type BinaryTradeRow } from "@/lib/binary-options";
import { getBinaryState, placeBinaryTrade } from "@/lib/binary.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/binary")({
  head: () => ({
    meta: [
      { title: "Binary options — TradeX" },
      {
        name: "description",
        content: "Trade simulated binary up/down options with fixed expiries and payouts of up to 90% per trade.",
      },
      { property: "og:title", content: "TradeX binary options" },
      { property: "og:description", content: "Higher/lower trades with 30 second to 1 hour expiries — paper trading." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BinaryPage,
});

function BinaryPage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const fetchState = useServerFn(getBinaryState);
  const place = useServerFn(placeBinaryTrade);
  const queryClient = useQueryClient();
  const now = useTick(1000);

  const { data: state } = useQuery({
    queryKey: ["binary-state", accountId],
    queryFn: () => fetchState({ data: { accountId } }),
    refetchInterval: 4000,
  });

  const [symbol, setSymbol] = useState("EURUSD");
  const [duration, setDuration] = useState(60);
  const [stake, setStake] = useState("50");
  const [busy, setBusy] = useState(false);

  const instruments = state?.instruments ?? [];
  const bySymbol = useMemo(() => indexBySymbol(instruments), [instruments]);
  const inst = bySymbol[symbol] ?? instruments[0];
  const account = (state?.accounts ?? []).find((a) => a.id === (accountId ?? state?.activeAccountId));
  const quote = inst ? quoteFor(inst, now || 0) : null;
  const dur = BINARY_DURATIONS.find((d) => d.seconds === duration)!;
  const stakeNum = Number(stake) || 0;
  const open = (state?.open ?? []) as BinaryTradeRow[];
  const settled = (state?.settled ?? []) as BinaryTradeRow[];

  const wins = settled.filter((t) => t.status === "won").length;
  const winRate = settled.length ? (wins / settled.length) * 100 : 0;
  const netPl = settled.reduce((sum, t) => sum + (Number(t.payout ?? 0) - Number(t.stake)), 0);

  async function submit(direction: "up" | "down") {
    if (!inst || !account) return;
    setBusy(true);
    try {
      await place({
        data: { accountId: account.id, symbol: inst.symbol, direction, stake: stakeNum, durationSeconds: duration },
      });
      toast.success(`${direction === "up" ? "HIGHER" : "LOWER"} trade placed on ${inst.symbol}.`);
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Trade rejected");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Binary options" subtitle="Fixed-time higher / lower trades — simulated">
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Panel className="p-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
              <div>
                <h2 className="font-display text-lg font-semibold">{inst?.symbol}</h2>
                <p className="text-xs text-muted-foreground">{inst?.name}</p>
              </div>
              {quote && inst && (
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Price</p>
                    <p className="num text-sm font-medium">{num(quote.mid, inst.digits)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Payout</p>
                    <p className="num text-sm font-medium text-up">+{Math.round(dur.rate * 100)}%</p>
                  </div>
                </div>
              )}
              <select
                aria-label="Instrument"
                value={inst?.symbol ?? ""}
                onChange={(e) => setSymbol(e.target.value)}
                className="ml-auto rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              >
                {instruments.map((i) => (
                  <option key={i.symbol} value={i.symbol}>
                    {i.symbol} — {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="h-96 px-2 pb-3 pt-2">
              {inst && (
                <CandleChart instrument={inst} timeframe="1m" now={now} indicators={DEFAULT_INDICATORS} />
              )}
            </div>
          </Panel>

          <Panel title="Active trades">
            {open.length === 0 ? (
              <Empty>No active binary trades. Pick an expiry and go higher or lower.</Empty>
            ) : (
              <div className="space-y-2">
                {open.map((t) => {
                  const i = bySymbol[t.symbol];
                  const live = i ? quoteFor(i, now || 0).mid : Number(t.entry_price);
                  const winning =
                    t.direction === "up" ? live > Number(t.entry_price) : live < Number(t.entry_price);
                  const left = secondsLeft(t, now || Date.now());
                  const progress = 1 - left / t.duration_seconds;
                  return (
                    <div key={t.id} className="rounded-xl border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2 font-medium">
                          {t.direction === "up" ? (
                            <ArrowUpRight className="size-4 text-up" />
                          ) : (
                            <ArrowDownRight className="size-4 text-down" />
                          )}
                          {t.symbol}
                        </span>
                        <span className="num text-xs text-muted-foreground">
                          entry {num(Number(t.entry_price), i?.digits ?? 2)} · now {num(live, i?.digits ?? 2)}
                        </span>
                        <span className={cn("num text-xs font-semibold", winning ? "text-up" : "text-down")}>
                          {winning ? "In the money" : "Out of the money"}
                        </span>
                        <span className="num text-sm font-semibold">{countdown(left)}</span>
                        <span className="num text-xs">
                          {money(Number(t.stake))} → {money(Number(t.stake) * (1 + Number(t.payout_rate)))}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", winning ? "bg-up" : "bg-down")}
                          style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="Trade history">
            {settled.length === 0 ? (
              <Empty>Settled binary trades will appear here.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <Th>Symbol</Th>
                      <Th>Direction</Th>
                      <Th right>Stake</Th>
                      <Th right>Entry</Th>
                      <Th right>Expiry</Th>
                      <Th right>Result</Th>
                      <Th right>P/L</Th>
                      <Th right>Settled</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {settled.map((t) => {
                      const pl = Number(t.payout ?? 0) - Number(t.stake);
                      const d = bySymbol[t.symbol]?.digits ?? 2;
                      return (
                        <tr key={t.id} className="border-t border-border">
                          <Td>{t.symbol}</Td>
                          <Td>
                            <span className={cn("uppercase", t.direction === "up" ? "text-up" : "text-down")}>
                              {t.direction === "up" ? "Higher" : "Lower"}
                            </span>
                          </Td>
                          <Td right>{money(Number(t.stake))}</Td>
                          <Td right>{num(Number(t.entry_price), d)}</Td>
                          <Td right>{t.expiry_price === null ? "—" : num(Number(t.expiry_price), d)}</Td>
                          <Td right className="capitalize">
                            {t.status}
                          </Td>
                          <Td right className={pl >= 0 ? "text-up" : "text-down"}>
                            {signedMoney(pl)}
                          </Td>
                          <Td right>{dateTime(t.settled_at)}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Trade ticket">
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

            <p className="text-xs text-muted-foreground">Balance {money(Number(account?.balance ?? 0))}</p>

            <div className="mt-3 space-y-1.5">
              <Label>Expiry</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {BINARY_DURATIONS.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setDuration(d.seconds)}
                    className={cn(
                      "rounded-md border border-border px-2 py-1.5 text-xs font-medium",
                      d.seconds === duration ? "bg-secondary text-secondary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <Label htmlFor="stake">Stake</Label>
              <Input id="stake" inputMode="decimal" value={stake} onChange={(e) => setStake(e.target.value)} />
              <div className="flex gap-1.5">
                {[10, 50, 100, 500].map((v) => (
                  <button
                    key={v}
                    onClick={() => setStake(String(v))}
                    className="flex-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <dl className="mt-4 space-y-1.5 rounded-xl bg-muted p-3 text-xs">
              <Row label="Payout rate" value={`+${Math.round(dur.rate * 100)}%`} />
              <Row label="Profit if correct" value={money(stakeNum * dur.rate)} />
              <Row label="Total return" value={money(stakeNum * (1 + dur.rate))} />
              <Row label="Loss if wrong" value={money(stakeNum)} />
            </dl>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                className="bg-up text-primary-foreground hover:bg-up/90"
                disabled={busy || !account || stakeNum <= 0}
                onClick={() => submit("up")}
              >
                <ArrowUpRight className="size-4" /> Higher
              </Button>
              <Button
                className="bg-down text-primary-foreground hover:bg-down/90"
                disabled={busy || !account || stakeNum <= 0}
                onClick={() => submit("down")}
              >
                <ArrowDownRight className="size-4" /> Lower
              </Button>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Simulated binary options. No real funds are at risk.
            </p>
          </Panel>

          <Panel title="Performance">
            <div className="space-y-2 text-sm">
              <Row label="Settled trades" value={String(settled.length)} />
              <Row label="Win rate" value={`${num(winRate, 1)}%`} />
              <Row label="Net result" value={signedMoney(netPl)} />
              <Row label="Open stake" value={money(open.reduce((s, t) => s + Number(t.stake), 0))} />
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
