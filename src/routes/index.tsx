import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, BarChart3, ShieldCheck, Timer, Wallet, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TradeX — Simulated Trading Terminal for Forex, Crypto & Stocks" },
      {
        name: "description",
        content:
          "TradeX is a risk-free paper trading platform with a pro terminal, live candlestick charts, binary options and portfolio tracking.",
      },
      { property: "og:title", content: "TradeX — Simulated Trading Terminal" },
      {
        property: "og:description",
        content:
          "Practice trading forex, crypto, stocks and indices with $100,000 in virtual funds. No real money, no risk.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: BarChart3,
    title: "Pro terminal",
    body: "Candlestick charts, multiple timeframes and built-in indicators on every instrument.",
    tint: "bg-sky",
  },
  {
    icon: Zap,
    title: "Market, limit & stop",
    body: "A full order simulation engine with margin, leverage, stop loss and take profit.",
    tint: "bg-mint",
  },
  {
    icon: Timer,
    title: "Binary options",
    body: "Up or down calls from 30 seconds to 1 hour with payouts up to 90%.",
    tint: "bg-butter",
  },
  {
    icon: Wallet,
    title: "Wallet & payouts",
    body: "Track deposits, withdrawals and every transaction in one clean ledger.",
    tint: "bg-peach",
  },
  {
    icon: ShieldCheck,
    title: "Verification flow",
    body: "A complete KYC journey so the experience mirrors a real brokerage.",
    tint: "bg-lilac",
  },
  {
    icon: ArrowUpRight,
    title: "Live portfolio",
    body: "Equity, free margin, open P/L and closed trade history, updated continuously.",
    tint: "bg-sky",
  },
];

const MARKETS = [
  { name: "EUR/USD", price: "1.0842", change: "+0.21%", up: true },
  { name: "BTC/USD", price: "64,180", change: "+1.84%", up: true },
  { name: "AAPL", price: "228.34", change: "-0.42%", up: false },
  { name: "XAU/USD", price: "2,341.6", change: "+0.63%", up: true },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="font-display text-2xl font-bold tracking-tight">
          Trade<span className="text-accent">X</span>
        </span>
        <nav className="flex items-center gap-2">
          <Link
            to="/auth"
            className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open account
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-14 pt-8 sm:pt-16">
          <span className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1 text-xs font-semibold text-ink">
            Paper trading · $100,000 virtual funds
          </span>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Trade the markets without risking a single rupee.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            TradeX is a full brokerage simulation — forex, crypto, stocks, indices and commodities,
            with a professional terminal, binary options and live portfolio analytics.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[var(--shadow-coral)] transition-transform hover:-translate-y-0.5"
            >
              Start trading free
            </Link>
            <Link
              to="/dashboard"
              className="rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold transition-colors hover:bg-muted"
            >
              Go to dashboard
            </Link>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MARKETS.map((m) => (
              <div
                key={m.name}
                className="rounded-card border border-border bg-card p-4 shadow-[var(--shadow-float)]"
              >
                <p className="text-xs font-medium text-muted-foreground">{m.name}</p>
                <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{m.price}</p>
                <p className={`mt-1 text-xs font-semibold ${m.up ? "text-up" : "text-down"}`}>
                  {m.change}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Everything a real desk gives you
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="rounded-card border border-border bg-card p-5">
                <span
                  className={`flex size-10 items-center justify-center rounded-xl ${f.tint} text-ink`}
                >
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-16">
          <div className="rounded-card bg-primary px-6 py-12 text-center text-primary-foreground">
            <h2 className="font-display text-3xl font-bold tracking-tight">
              Your account is funded in seconds
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm opacity-80">
              Sign up, get $100,000 in simulated capital and place your first order right away.
            </p>
            <Link
              to="/auth"
              className="mt-6 inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground"
            >
              Create your free account
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-6 text-center text-xs text-muted-foreground">
        TradeX is a simulated broker. All prices, orders and balances are paper trading only.
      </footer>
    </div>
  );
}
