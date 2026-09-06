import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Clock, Minus, Plus, Trophy } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { QuotexChart, type TradeMarker } from "@/components/QuotexChart";
import { Empty, Panel, Td, Th } from "@/components/trading-ui";
import { useTick } from "@/hooks/useTick";
import { dateTime, money, num, signedMoney } from "@/lib/format";
import { indexBySymbol } from "@/lib/instrument-utils";
import { quoteFor, type TimeframeKey } from "@/lib/market-sim";
import { BINARY_DURATIONS, countdown, secondsLeft, type BinaryTradeRow } from "@/lib/binary-options";
import { getBinaryState, placeBinaryTrade } from "@/lib/binary.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/binary")({
  head: () => ({
    meta: [
      { title: "Binary trading — TradeX" },
      {
        name: "description",
        content: "Fixed-time up/down trading on forex, crypto, stocks and indices with payouts up to 90% per trade.",
      },
      { property: "og:title", content: "TradeX binary trading room" },
      { property: "og:description", content: "Live chart, one-tap higher/lower trades and instant expiries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BinaryPage,
});

const TFS: TimeframeKey[] = ["1m", "5m", "15m", "1H"];

function BinaryPage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const fetchState = useServerFn(getBinaryState);
  const place = useServerFn(placeBinaryTrade);
  const queryClient = useQueryClient();
  const now = useTick(1000);

  const { data: state } = useQuery({
    queryKey: ["binary-state", accountId],
    queryFn: () => fetchState({ data: { accountId } }),
    refetchInterval: 3000,
  });

  const [symbol, setSymbol] = useState("EURUSD");
  const [timeframe, setTimeframe] = useState<TimeframeKey>("1m");
  const [mode, setMode] = useState<"candles" | "area">("candles");
  const [duration, setDuration] = useState(60);
  const [stake, setStake] = useState(50);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"open" | "history">("open");

  const instruments = state?.instruments ?? [];
  const bySymbol = useMemo(() => indexBySymbol(instruments), [instruments]);
  const inst = bySymbol[symbol] ?? instruments[0];
  const account = (state?.accounts ?? []).find((a) => a.id === (accountId ?? state?.activeAccountId));
  const quote = inst ? quoteFor(inst, now || 0) : null;
  const dur = BINARY_DURATIONS.find((d) => d.seconds === duration)!;
  const open = (state?.open ?? []) as BinaryTradeRow[];
  const settled = (state?.settled ?? []) as BinaryTradeRow[];

  const markers: TradeMarker[] = open
    .filter((t) => t.symbol === inst?.symbol)
    .map((t) => ({
      id: t.id,
      entry: Number(t.entry_price),
      direction: t.direction,
      expiresAtMs: new Date(t.expires_at).getTime(),
      openedAtMs: new Date(t.opened_at).getTime(),
    }));

  const wins = settled.filter((t) => t.status === "won").length;
  const winRate = settled.length ? (wins / settled.length) * 100 : 0;
  const netPl = settled.reduce((sum, t) => sum + (Number(t.payout ?? 0) - Number(t.stake)), 0);

  async function submit(direction: "up" | "down") {
    if (!inst || !account) return;
    setBusy(true);
    try {
      await place({
        data: { accountId: account.id, symbol: inst.symbol, direction, stake, durationSeconds: duration },
      });
      toast.success(`${direction === "up" ? "UP" : "DOWN"} · ${money(stake)} on ${inst.symbol}`);
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Trade rejected");
    } finally {
      setBusy(false);
    }
  }

  const favourites = instruments.slice(0, 14);

  return (
    <AppShell title="Trading room" subtitle="Fixed-time up / down trading — simulated">
      {/* Asset strip */}
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        {favourites.map((i) => {
          const q = quoteFor(i, now || 0);
          const active = i.symbol === inst?.symbol;
          return (
            <button
              key={i.symbol}
              onClick={() => setSymbol(i.symbol)}
              className={cn(
                "shrink-0 rounded-xl border border-border px-3 py-2 text-left transition-colors",
                active ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
              )}
            >
              <span className="block text-xs font-semibold">{i.symbol}</span>
              <span className={cn("num block text-[11px]", active ? "opacity-80" : "text-muted-foreground")}>
                {num(q.mid, i.digits)}
              </span>
            </button>
          );
        })}
        <Link
          to="/markets"
          className="flex shrink-0 items-center rounded-xl border border-dashed border-border px-3 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          All markets
        </Link>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_330px]">
        <div className="space-y-3">
          <Panel className="p-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold">{inst?.symbol}</h2>
                <p className="truncate text-[11px] text-muted-foreground">{inst?.name}</p>
              </div>
              {quote && inst && (
                <>
                  <p className="num text-lg font-semibold">{num(quote.mid, inst.digits)}</p>
                  <span
                    className={cn(
                      "num rounded-full px-2 py-0.5 text-xs font-semibold",
                      quote.changePct >= 0 ? "bg-mint text-ink" : "bg-peach text-ink",
                    )}
                  >
                    {quote.changePct >= 0 ? "+" : ""}
                    {num(quote.changePct, 2)}%
                  </span>
                </>
              )}
              <span className="ml-auto rounded-full bg-mint px-2.5 py-1 text-xs font-bold text-ink">
                Payout +{Math.round(dur.rate * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
              {TFS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium",
                    t === timeframe ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {t}
                </button>
              ))}
              <div className="ml-auto flex gap-1.5">
                {(["candles", "area"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium capitalize",
                      m === mode ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[340px] px-1 pb-2 pt-1 sm:h-[440px]">
              {inst && (
                <QuotexChart
                  instrument={inst}
                  timeframe={timeframe}
                  now={now}
                  markers={markers}
                  mode={mode}
                />
              )}
            </div>
          </Panel>

          <Panel className="p-0">
            <div className="flex items-center gap-1 border-b border-border px-3 py-2">
              {(["open", "history"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold capitalize",
                    t === tab ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {t === "open" ? `Active (${open.length})` : "History"}
                </button>
              ))}
              <Link
                to="/leaderboard"
                className="ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                <Trophy className="size-3.5" /> Leaderboard
              </Link>
            </div>

            <div className="p-3">
              {tab === "open" ? (
                open.length === 0 ? (
                  <Empty>No active trades. Pick an expiry and tap UP or DOWN.</Empty>
                ) : (
                  <div className="space-y-2">
                    {open.map((t) => {
                      const i = bySymbol[t.symbol];
                      const live = i ? quoteFor(i, now || 0).mid : Number(t.entry_price);
                      const winning = t.direction === "up" ? live > Number(t.entry_price) : live < Number(t.entry_price);
                      const left = secondsLeft(t, now || Date.now());
                      const progress = 1 - left / t.duration_seconds;
                      return (
                        <div key={t.id} className="rounded-xl border border-border bg-surface p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="flex items-center gap-1.5 font-semibold">
                              {t.direction === "up" ? (
                                <ArrowUpRight className="size-4 text-up" />
                              ) : (
                                <ArrowDownRight className="size-4 text-down" />
                              )}
                              {t.symbol}
                            </span>
                            <span className="num text-[11px] text-muted-foreground">
                              {num(Number(t.entry_price), i?.digits ?? 2)} → {num(live, i?.digits ?? 2)}
                            </span>
                            <span
                              className={cn(
                                "num rounded-full px-2 py-0.5 text-[11px] font-bold",
                                winning ? "bg-mint text-ink" : "bg-peach text-ink",
                              )}
                            >
                              {winning ? signedMoney(Number(t.stake) * Number(t.payout_rate)) : signedMoney(-Number(t.stake))}
                            </span>
                            <span className="num flex items-center gap-1 text-sm font-bold">
                              <Clock className="size-3.5" />
                              {countdown(left)}
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
                )
              ) : settled.length === 0 ? (
                <Empty>Settled trades will appear here.</Empty>
              ) : (
                <div className="-mx-3 overflow-x-auto px-3">
                  <table className="w-full min-w-140 text-sm">
                    <thead>
                      <tr>
                        <Th>Asset</Th>
                        <Th>Side</Th>
                        <Th right>Stake</Th>
                        <Th right>Entry</Th>
                        <Th right>Expiry</Th>
                        <Th right>Result</Th>
                        <Th right>P/L</Th>
                        <Th right>Closed</Th>
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
                              <span className={cn("font-semibold uppercase", t.direction === "up" ? "text-up" : "text-down")}>
                                {t.direction}
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
            </div>
          </Panel>
        </div>

        {/* Trade ticket — Quotex style */}
        <div className="space-y-3">
          <Panel className="p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {(state?.accounts ?? []).map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAccountId(a.id)}
                  className={cn(
                    "rounded-full border border-border px-2.5 py-1 text-xs font-semibold capitalize",
                    a.id === account?.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {a.type}
                </button>
              ))}
              <span className="num ml-auto text-sm font-bold">{money(Number(account?.balance ?? 0))}</span>
            </div>

            <Stepper
              label="Investment"
              value={money(stake)}
              onDown={() => setStake((v) => Math.max(1, Math.round(v - Math.max(1, v * 0.2))))}
              onUp={() => setStake((v) => Math.min(100000, Math.round(v + Math.max(1, v * 0.2))))}
            />
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[10, 50, 100, 500].map((v) => (
                <button
                  key={v}
                  onClick={() => setStake(v)}
                  className={cn(
                    "rounded-lg border border-border py-1 text-xs font-medium",
                    stake === v ? "bg-secondary text-secondary-foreground" : "hover:bg-muted",
                  )}
                >
                  ${v}
                </button>
              ))}
            </div>

            <div className="mt-3">
              <Stepper
                label="Expiry time"
                value={dur.label}
                onDown={() => {
                  const i = BINARY_DURATIONS.findIndex((d) => d.seconds === duration);
                  setDuration(BINARY_DURATIONS[Math.max(0, i - 1)]!.seconds);
                }}
                onUp={() => {
                  const i = BINARY_DURATIONS.findIndex((d) => d.seconds === duration);
                  setDuration(BINARY_DURATIONS[Math.min(BINARY_DURATIONS.length - 1, i + 1)]!.seconds);
                }}
              />
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {BINARY_DURATIONS.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setDuration(d.seconds)}
                    className={cn(
                      "rounded-lg border border-border py-1 text-xs font-medium",
                      d.seconds === duration ? "bg-secondary text-secondary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-butter p-3 text-center">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">Your payout</p>
              <p className="num font-display text-2xl font-bold text-ink">{money(stake * (1 + dur.rate))}</p>
              <p className="num text-xs font-semibold text-ink-soft">
                profit {money(stake * dur.rate)} · +{Math.round(dur.rate * 100)}%
              </p>
            </div>

            <div className="mt-3 grid gap-2">
              <button
                disabled={busy || !account || stake <= 0}
                onClick={() => submit("up")}
                className="flex items-center justify-center gap-2 rounded-2xl bg-up py-4 font-display text-lg font-bold text-primary-foreground shadow-[var(--shadow-float)] transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                <ArrowUpRight className="size-5" /> UP
              </button>
              <button
                disabled={busy || !account || stake <= 0}
                onClick={() => submit("down")}
                className="flex items-center justify-center gap-2 rounded-2xl bg-down py-4 font-display text-lg font-bold text-primary-foreground shadow-[var(--shadow-float)] transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                <ArrowDownRight className="size-5" /> DOWN
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Simulated trading. No real funds are at risk.
            </p>
          </Panel>

          <Panel title="Your stats">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Stat label="Trades" value={String(settled.length)} />
              <Stat label="Win rate" value={`${num(winRate, 0)}%`} />
              <Stat label="Net result" value={signedMoney(netPl)} />
              <Stat label="In play" value={money(open.reduce((s, t) => s + Number(t.stake), 0))} />
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

function Stepper({
  label,
  value,
  onUp,
  onDown,
}: {
  label: string;
  value: string;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-2 py-2">
      <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <button onClick={onDown} aria-label={`Decrease ${label}`} className="rounded-lg bg-muted p-1.5 hover:bg-secondary">
          <Minus className="size-4" />
        </button>
        <span className="num font-display text-lg font-bold">{value}</span>
        <button onClick={onUp} aria-label={`Increase ${label}`} className="rounded-lg bg-muted p-1.5 hover:bg-secondary">
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="num font-semibold">{value}</p>
    </div>
  );
}
