import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Crown, Medal, Trophy } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Empty, Panel, Td, Th } from "@/components/trading-ui";
import { money, num, signedMoney } from "@/lib/format";
import { getLeaderboard, type LeaderboardPeriod } from "@/lib/leaderboard.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — TradeX top traders" },
      {
        name: "description",
        content: "See the highest earning TradeX traders by profit, win rate and volume for the day, week or month.",
      },
      { property: "og:title", content: "TradeX trader leaderboard" },
      { property: "og:description", content: "Daily, weekly and monthly rankings of the best performing traders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeaderboardPage,
});

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "day", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];

function LeaderboardPage() {
  const fetchBoard = useServerFn(getLeaderboard);
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");

  const { data } = useQuery({
    queryKey: ["leaderboard", period],
    queryFn: () => fetchBoard({ data: { period } }),
    refetchInterval: 20_000,
  });

  const rows = data?.rows ?? [];
  const meId = data?.meId;
  const podium = rows.slice(0, 3);

  return (
    <AppShell title="Leaderboard" subtitle="Top traders ranked by realised profit">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              "rounded-full border border-border px-3 py-1.5 text-xs font-semibold",
              p.key === period ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {podium.length > 0 && (
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          {podium.map((r, i) => (
            <div
              key={r.userId}
              className={cn(
                "rounded-[var(--radius-card)] border border-border p-4",
                i === 0 ? "bg-butter" : i === 1 ? "bg-lilac" : "bg-peach",
              )}
            >
              <div className="flex items-center gap-2 text-ink">
                {i === 0 ? <Crown className="size-4" /> : i === 1 ? <Trophy className="size-4" /> : <Medal className="size-4" />}
                <span className="text-xs font-bold uppercase tracking-wide">#{i + 1}</span>
              </div>
              <p className="mt-1 truncate font-display text-lg font-bold text-ink">{r.name}</p>
              <p className="num font-display text-xl font-bold text-ink">{signedMoney(r.profit)}</p>
              <p className="num text-xs text-ink-soft">
                {r.trades} trades · {num(r.winRate, 0)}% win rate
              </p>
            </div>
          ))}
        </div>
      )}

      <Panel title="Rankings">
        {rows.length === 0 ? (
          <Empty>No settled trades in this period yet — place a trade to enter the ranking.</Empty>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-140 text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <Th>#</Th>
                  <Th>Trader</Th>
                  <Th right>Trades</Th>
                  <Th right>Win rate</Th>
                  <Th right>Volume</Th>
                  <Th right>Profit</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.userId}
                    className={cn("border-b border-border/60 last:border-0", r.userId === meId && "bg-mint/40")}
                  >
                    <Td>{i + 1}</Td>
                    <Td>
                      <span className="font-medium">{r.name}</span>
                      {r.userId === meId && (
                        <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase">
                          you
                        </span>
                      )}
                    </Td>
                    <Td right>{r.trades}</Td>
                    <Td right>{num(r.winRate, 0)}%</Td>
                    <Td right>{money(r.volume)}</Td>
                    <Td right className={r.profit >= 0 ? "text-up" : "text-down"}>
                      {signedMoney(r.profit)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
