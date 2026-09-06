import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bitcoin, Building2, Check, Copy, CreditCard, Wallet } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { useDepositAddresses } from "@/components/DepositAddresses";
import { MetricCard, Panel, TransactionsTable, type TxRow } from "@/components/trading-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "@/lib/format";
import type { DepositAddressRow } from "@/lib/deposit-address.functions";
import { getWallet, requestDeposit, requestWithdrawal } from "@/lib/wallet.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "Deposit & withdraw — TradeX" },
      {
        name: "description",
        content: "Top up your live or demo account with crypto, card or bank transfer and request payouts.",
      },
      { property: "og:title", content: "TradeX cashier" },
      { property: "og:description", content: "Deposits, withdrawals and full transaction history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

type AccountRow = { id: string; type: string; balance: number; currency: string };

const DEPOSIT_PRESETS = [10, 50, 100, 250, 500, 1000];
const WITHDRAW_PRESETS = [10, 50, 100, 500];

const CRYPTO = "crypto" as const;
const CARD = "card" as const;
const BANK = "bank" as const;

const METHODS = [
  { key: CRYPTO, label: "Crypto", hint: "USDT · BTC · ETH · 5–30 min", icon: Bitcoin },
  { key: CARD, label: "Bank card", hint: "Visa / Mastercard · instant", icon: CreditCard },
  { key: BANK, label: "Bank transfer", hint: "1–3 business days", icon: Building2 },
];

const WITHDRAW_METHODS = [
  { key: CRYPTO, label: "Crypto wallet", hint: "USDT TRC20 · 1–24 h", icon: Bitcoin },
  { key: CARD, label: "Bank card", hint: "Back to the card you used", icon: CreditCard },
  { key: BANK, label: "Bank account", hint: "1–5 business days", icon: Building2 },
];

function MethodTile({
  active,
  label,
  hint,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  hint: string;
  icon: typeof Bitcoin;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-[var(--radius-card)] border p-3 text-left transition",
        active ? "border-accent bg-accent/10" : "border-border hover:border-accent/60",
      )}
    >
      <span className={cn("grid size-9 place-items-center rounded-full", active ? "bg-accent/20" : "bg-secondary")}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
      {active && <Check className="ml-auto size-4 text-accent" />}
    </button>
  );
}

function AmountPad({
  presets,
  amount,
  setAmount,
  min,
}: {
  presets: number[];
  amount: string;
  setAmount: (v: string) => void;
  min: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="amount">Amount (USD)</Label>
      <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div className="grid grid-cols-3 gap-2">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(String(p))}
            className={cn(
              "rounded-lg border px-2 py-1.5 text-sm font-medium transition",
              Number(amount) === p ? "border-accent bg-accent/10" : "border-border hover:border-accent/60",
            )}
          >
            ${p}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Minimum ${min}.</p>
    </div>
  );
}

function WalletPage() {
  const fetchWallet = useServerFn(getWallet);
  const deposit = useServerFn(requestDeposit);
  const withdraw = useServerFn(requestWithdrawal);
  const queryClient = useQueryClient();

  const { data } = useQuery({ queryKey: ["wallet"], queryFn: () => fetchWallet(), refetchInterval: 15_000 });
  const { data: addressData } = useDepositAddresses();
  const addresses = ((addressData?.addresses ?? []) as DepositAddressRow[]).filter((a) => a.is_active);

  const accounts = (data?.accounts ?? []) as AccountRow[];
  const kycApproved = data?.kycStatus === "approved";

  const [accountId, setAccountId] = useState<string | null>(null);
  const active = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const isDemo = active?.type === "demo";

  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [depositMethod, setDepositMethod] = useState<string>(CRYPTO);
  const [withdrawMethod, setWithdrawMethod] = useState<string>(CRYPTO);
  const [network, setNetwork] = useState<string | null>(null);
  const [amount, setAmount] = useState("100");
  const [reference, setReference] = useState("");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);

  const chosenAddress = useMemo(
    () => addresses.find((a) => a.network === network) ?? addresses[0],
    [addresses, network],
  );

  const transactions = (data?.transactions ?? []) as TxRow[];
  const pendingCount = transactions.filter((t) => t.status === "pending").length;

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied.");
    } catch {
      toast.error("Could not copy — select the text manually.");
    }
  }

  async function submitDeposit() {
    if (!active) return;
    setBusy(true);
    try {
      const methodLabel = isDemo
        ? "Demo top-up"
        : depositMethod === CRYPTO
          ? `Crypto — ${chosenAddress?.network ?? "USDT"}`
          : depositMethod === CARD
            ? "Bank card"
            : "Bank transfer";
      const res = await deposit({
        data: { accountId: active.id, amount: Number(amount), method: methodLabel, destination: reference },
      });
      toast.success(
        res.instant
          ? "Demo balance topped up."
          : "Deposit submitted — it will be credited once the payment is confirmed.",
      );
      setReference("");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitWithdrawal() {
    if (!active) return;
    setBusy(true);
    try {
      const methodLabel =
        withdrawMethod === CRYPTO ? "Crypto wallet" : withdrawMethod === CARD ? "Bank card" : "Bank account";
      await withdraw({ data: { accountId: active.id, amount: Number(amount), method: methodLabel, destination } });
      toast.success("Withdrawal requested — it is now under review.");
      setDestination("");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Cashier" subtitle="Deposit and withdraw — simulated funds, no real money moves">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((a) => (
          <button key={a.id} onClick={() => setAccountId(a.id)} className="text-left">
            <MetricCard
              label={`${a.type} account`}
              value={money(Number(a.balance), a.currency)}
              hint={a.id === active?.id ? "Selected" : "Tap to select"}
            />
          </button>
        ))}
        <MetricCard label="Pending requests" value={String(pendingCount)} hint="Awaiting review" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Panel>
            <div className="grid grid-cols-2 gap-2 rounded-full bg-secondary p-1">
              {(["deposit", "withdraw"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-full px-3 py-2 text-sm font-semibold capitalize transition",
                    tab === t ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === "deposit" ? (
              <div className="mt-4 space-y-4">
                {isDemo ? (
                  <p className="rounded-lg border border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
                    Demo account — top up instantly with simulated funds as often as you like. Withdrawals are only
                    available on the live account.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {METHODS.map((m) => (
                      <MethodTile
                        key={m.key}
                        active={depositMethod === m.key}
                        label={m.label}
                        hint={m.hint}
                        icon={m.icon}
                        onClick={() => setDepositMethod(m.key)}
                      />
                    ))}
                  </div>
                )}

                <AmountPad presets={DEPOSIT_PRESETS} amount={amount} setAmount={setAmount} min={isDemo ? 1 : 10} />

                {!isDemo && depositMethod === CRYPTO && (
                  <div className="space-y-2 rounded-[var(--radius-card)] border border-border p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Send exactly ${amount || 0} to
                    </p>
                    {addresses.length > 1 && (
                      <div className="flex flex-wrap gap-1.5">
                        {addresses.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => setNetwork(a.network)}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs font-medium",
                              chosenAddress?.id === a.id ? "border-accent bg-accent/10" : "border-border",
                            )}
                          >
                            {a.network}
                          </button>
                        ))}
                      </div>
                    )}
                    {chosenAddress ? (
                      <>
                        <div className="flex items-start gap-2">
                          <code className="min-w-0 flex-1 break-all text-sm">{chosenAddress.address}</code>
                          <button aria-label="Copy address" onClick={() => copy(chosenAddress.address)}>
                            <Copy className="size-4 text-muted-foreground" />
                          </button>
                        </div>
                        {chosenAddress.memo && (
                          <p className="text-xs text-muted-foreground">
                            Memo / tag: <span className="break-all text-foreground">{chosenAddress.memo}</span>
                          </p>
                        )}
                        {chosenAddress.instructions && (
                          <p className="text-xs text-muted-foreground">{chosenAddress.instructions}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No deposit address is published yet.</p>
                    )}
                  </div>
                )}

                {!isDemo && (
                  <div className="space-y-1.5">
                    <Label htmlFor="reference">
                      {depositMethod === CRYPTO ? "Transaction ID (TxID)" : "Payment reference / last 4 digits"}
                    </Label>
                    <Input
                      id="reference"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder={depositMethod === CRYPTO ? "Paste the TxID after sending" : "e.g. 4242"}
                      maxLength={200}
                    />
                  </div>
                )}

                <Button className="w-full" disabled={busy || !active} onClick={submitDeposit}>
                  {isDemo ? "Top up demo balance" : "I have paid — submit deposit"}
                </Button>
                {!isDemo && (
                  <p className="text-[11px] text-muted-foreground">
                    Funds appear on your balance once the payment is confirmed by our team.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {isDemo ? (
                  <div className="rounded-[var(--radius-card)] border border-border p-4 text-center">
                    <Wallet className="mx-auto size-6 text-muted-foreground" />
                    <p className="mt-2 text-sm font-semibold">Withdrawals are not available on demo</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Demo funds are simulated. Switch to your live account above to request a payout.
                    </p>
                  </div>
                ) : (
                  <>
                    {!kycApproved && (
                      <div className="rounded-lg border border-border bg-secondary/50 p-3 text-xs">
                        <p className="font-semibold">Verification required</p>
                        <p className="mt-1 text-muted-foreground">
                          Complete identity verification before your first payout.{" "}
                          <Link to="/verification" className="underline">
                            Verify now
                          </Link>
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      {WITHDRAW_METHODS.map((m) => (
                        <MethodTile
                          key={m.key}
                          active={withdrawMethod === m.key}
                          label={m.label}
                          hint={m.hint}
                          icon={m.icon}
                          onClick={() => setWithdrawMethod(m.key)}
                        />
                      ))}
                    </div>

                    <AmountPad presets={WITHDRAW_PRESETS} amount={amount} setAmount={setAmount} min={10} />

                    <div className="space-y-1.5">
                      <Label htmlFor="destination">
                        {withdrawMethod === CRYPTO ? "Your wallet address" : "Card / account number"}
                      </Label>
                      <Input
                        id="destination"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder={withdrawMethod === CRYPTO ? "TRC20 address" : "Account or card number"}
                        maxLength={200}
                      />
                    </div>

                    <Button className="w-full" disabled={busy || !active} onClick={submitWithdrawal}>
                      Request withdrawal
                    </Button>
                    <p className="text-[11px] text-muted-foreground">
                      Payouts are reviewed manually and usually processed within 24 hours. Funds tied up as margin on
                      open trades cannot be withdrawn.
                    </p>
                  </>
                )}
              </div>
            )}
          </Panel>

        </div>

        <Panel title="Transaction history">
          <TransactionsTable rows={transactions} />
        </Panel>
      </div>
    </AppShell>
  );
}
