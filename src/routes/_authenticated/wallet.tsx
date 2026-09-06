import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { DepositAddresses } from "@/components/DepositAddresses";
import { MetricCard, Panel, TransactionsTable, type TxRow } from "@/components/trading-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "@/lib/format";
import {
  deletePaymentMethod,
  getWallet,
  requestDeposit,
  requestWithdrawal,
  savePaymentMethod,
} from "@/lib/wallet.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — TradeX" },
      { name: "description", content: "Fund your simulated account, request withdrawals and manage payment methods." },
      { property: "og:title", content: "TradeX wallet" },
      { property: "og:description", content: "Simulated deposits, withdrawals and transaction history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const fetchWallet = useServerFn(getWallet);
  const deposit = useServerFn(requestDeposit);
  const withdraw = useServerFn(requestWithdrawal);
  const saveMethod = useServerFn(savePaymentMethod);
  const removeMethod = useServerFn(deletePaymentMethod);
  const queryClient = useQueryClient();

  const { data } = useQuery({ queryKey: ["wallet"], queryFn: () => fetchWallet(), refetchInterval: 15_000 });

  const accounts = (data?.accounts ?? []) as { id: string; type: string; balance: number; currency: string }[];
  const [accountId, setAccountId] = useState<string | null>(null);
  const active = accounts.find((a) => a.id === accountId) ?? accounts[0];

  const [amount, setAmount] = useState("1000");
  const [method, setMethod] = useState("Visa card");
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [last4, setLast4] = useState("");

  async function run(kind: "deposit" | "withdraw") {
    if (!active) return;
    setBusy(true);
    try {
      const fn = kind === "deposit" ? deposit : withdraw;
      await fn({ data: { accountId: active.id, amount: Number(amount), method } });
      toast.success(kind === "deposit" ? "Deposit processed (simulated)." : "Withdrawal requested.");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Wallet" subtitle="Simulated funding — no real money is moved">
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
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        <Panel title="Transactions">
          <TransactionsTable rows={(data?.transactions ?? []) as TxRow[]} />
        </Panel>

        <div className="space-y-4">
          <DepositAddresses />

          <Panel title="Move funds">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="method">Method</Label>
                <Input id="method" value={method} onChange={(e) => setMethod(e.target.value)} maxLength={60} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button disabled={busy || !active} onClick={() => run("deposit")}>
                  Deposit
                </Button>
                <Button variant="outline" disabled={busy || !active} onClick={() => run("withdraw")}>
                  Withdraw
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Demo accounts are credited instantly. Withdrawals go to review.
              </p>
            </div>
          </Panel>

          <Panel title="Payment methods">
            <ul className="space-y-2">
              {(data?.methods ?? []).map((m) => {
                const pm = m as { id: string; label: string; kind: string; last4: string | null };
                return (
                  <li
                    key={pm.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span>
                      {pm.label} <span className="text-muted-foreground">•••• {pm.last4}</span>
                    </span>
                    <button
                      aria-label="Remove payment method"
                      onClick={async () => {
                        await removeMethod({ data: { id: pm.id } });
                        await queryClient.invalidateQueries({ queryKey: ["wallet"] });
                      }}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className={cn("mt-3 space-y-2")}>
              <Input placeholder="Label (e.g. Personal Visa)" value={label} onChange={(e) => setLabel(e.target.value)} />
              <Input placeholder="Last 4 digits" value={last4} onChange={(e) => setLast4(e.target.value)} maxLength={4} />
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  try {
                    await saveMethod({ data: { label, kind: "card", last4 } });
                    setLabel("");
                    setLast4("");
                    toast.success("Payment method saved.");
                    await queryClient.invalidateQueries({ queryKey: ["wallet"] });
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not save method");
                  }
                }}
              >
                Add method
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
