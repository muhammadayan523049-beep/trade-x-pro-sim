import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Empty, MetricCard, Panel, StatusTag, Td, Th } from "@/components/trading-ui";
import { Button } from "@/components/ui/button";
import { dateTime, money } from "@/lib/format";
import {
  adjustBalance,
  getAdminOverview,
  reviewKyc,
  reviewTransaction,
  setUserRole,
  setUserSuspended,
} from "@/lib/admin.functions";


export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin console — TradeX" },
      { name: "description", content: "Administer TradeX users, verification reviews and pending wallet transactions." },
      { property: "og:title", content: "TradeX admin console" },
      { property: "og:description", content: "User, verification and transaction administration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  is_suspended: boolean;
  created_at: string;
}
interface TxRowAdmin {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  status: string;
  method: string | null;
  created_at: string;
}
interface KycRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  country: string | null;
  status: string;
  submitted_at: string | null;
}

function AdminPage() {
  const fetchOverview = useServerFn(getAdminOverview);
  const kycFn = useServerFn(reviewKyc);
  const txFn = useServerFn(reviewTransaction);
  const suspendFn = useServerFn(setUserSuspended);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
    refetchInterval: 20_000,
    retry: false,
  });

  async function act(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <AppShell title="Admin console">
        <Panel>
          <Empty>Admin access required.</Empty>
        </Panel>
      </AppShell>
    );
  }

  const profiles = (data?.profiles ?? []) as ProfileRow[];
  const transactions = (data?.transactions ?? []) as TxRowAdmin[];
  const kyc = (data?.kyc ?? []) as KycRow[];
  const pendingTx = transactions.filter((t) => t.status === "pending");
  const pendingKyc = kyc.filter((k) => k.status === "pending");
  const accounts = (data?.accounts ?? []) as { balance: number }[];

  return (
    <AppShell title="Admin console" subtitle="Users, verification and wallet review">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Users" value={String(profiles.length)} />
        <MetricCard label="Pending KYC" value={String(pendingKyc.length)} />
        <MetricCard label="Pending transactions" value={String(pendingTx.length)} />
        <MetricCard
          label="Platform balance"
          value={money(accounts.reduce((s, a) => s + Number(a.balance ?? 0), 0))}
        />
      </div>

      <div className="mt-4 space-y-4">
        <Panel title="Verification queue">
          {pendingKyc.length === 0 ? (
            <Empty>No verifications waiting for review.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Country</Th>
                  <Th>Submitted</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {pendingKyc.map((k) => (
                  <tr key={k.user_id} className="border-t border-border">
                    <Td>
                      {k.first_name} {k.last_name}
                    </Td>
                    <Td>{k.country ?? "—"}</Td>
                    <Td>{dateTime(k.submitted_at)}</Td>
                    <Td right>
                      <span className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            act(() => kycFn({ data: { userId: k.user_id, status: "approved", note: "" } }), "Approved.")
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () => kycFn({ data: { userId: k.user_id, status: "rejected", note: "Details unclear." } }),
                              "Rejected.",
                            )
                          }
                        >
                          Reject
                        </Button>
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Pending transactions">
          {pendingTx.length === 0 ? (
            <Empty>Nothing awaiting approval.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Type</Th>
                  <Th right>Amount</Th>
                  <Th>Method</Th>
                  <Th>Created</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {pendingTx.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <Td className="capitalize">{t.type}</Td>
                    <Td right>{money(Number(t.amount))}</Td>
                    <Td>{t.method ?? "—"}</Td>
                    <Td>{dateTime(t.created_at)}</Td>
                    <Td right>
                      <span className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            act(() => txFn({ data: { transactionId: t.id, status: "completed" } }), "Approved.")
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            act(() => txFn({ data: { transactionId: t.id, status: "rejected" } }), "Rejected.")
                          }
                        >
                          Reject
                        </Button>
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Users" subtitle="Full control: roles, access and balances">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th right>Balance</Th>
                  <Th>Joined</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const isAdmin = adminIds.has(p.id);
                  const userAccounts = accountsByUser.get(p.id) ?? [];
                  const total = userAccounts.reduce((s, a) => s + Number(a.balance ?? 0), 0);
                  const primary = userAccounts[0];
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <Td>{p.full_name || "—"}</Td>
                      <Td>{p.email}</Td>
                      <Td>
                        <span
                          className={
                            isAdmin
                              ? "rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground"
                              : "text-xs text-muted-foreground"
                          }
                        >
                          {isAdmin ? "Admin" : "User"}
                        </span>
                      </Td>
                      <Td>
                        <StatusTag status={p.is_suspended ? "rejected" : "completed"} />
                      </Td>
                      <Td right>{money(total)}</Td>
                      <Td>{dateTime(p.created_at)}</Td>
                      <Td right>
                        <span className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || !primary}
                            onClick={() => {
                              if (!primary) return;
                              const raw = window.prompt(
                                `Adjust balance for ${p.email} (use a minus sign to deduct):`,
                                "1000",
                              );
                              if (raw === null) return;
                              const amount = Number(raw);
                              if (!Number.isFinite(amount) || amount === 0) {
                                toast.error("Enter a valid amount.");
                                return;
                              }
                              void act(
                                () => balanceFn({ data: { accountId: primary.id, amount, note: "" } }),
                                "Balance updated.",
                              );
                            }}
                          >
                            Adjust funds
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              act(
                                () => roleFn({ data: { userId: p.id, admin: !isAdmin } }),
                                isAdmin ? "Admin access removed." : "Admin access granted.",
                              )
                            }
                          >
                            {isAdmin ? "Remove admin" : "Make admin"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              act(
                                () => suspendFn({ data: { userId: p.id, suspended: !p.is_suspended } }),
                                p.is_suspended ? "User reinstated." : "User suspended.",
                              )
                            }
                          >
                            {p.is_suspended ? "Reinstate" : "Suspend"}
                          </Button>
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

      </div>
    </AppShell>
  );
}
