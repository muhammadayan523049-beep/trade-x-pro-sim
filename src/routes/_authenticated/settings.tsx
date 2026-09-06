import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, LogOut, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, useMe } from "@/components/AppShell";
import { Panel } from "@/components/trading-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { updateProfile } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account — TradeX" },
      { name: "description", content: "Manage your TradeX account details and preferences." },
      { property: "og:title", content: "TradeX account" },
      { property: "og:description", content: "Account details and preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function AccountPage() {
  const { data: me } = useMe();
  const save = useServerFn(updateProfile);
  const queryClient = useQueryClient();
  const profile = me?.profile as
    | {
        id: string;
        email: string;
        full_name: string;
        phone: string | null;
        country: string | null;
        notify_email: boolean;
        notify_trade_alerts: boolean;
        created_at?: string;
      }
    | null
    | undefined;

  const accounts = (me?.accounts ?? []) as { id: string; type: string; balance: number; currency: string }[];
  const demo = accounts.find((a) => a.type === "demo");
  const live = accounts.find((a) => a.type === "live");

  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const text = (key: "full_name" | "phone" | "country") => form[key] ?? profile?.[key] ?? "";
  const initials = (profile?.full_name || profile?.email || "T").trim().slice(0, 1).toUpperCase();

  async function persist(patch: Record<string, unknown>, message = "Saved.") {
    setBusy(true);
    try {
      await save({ data: patch as never });
      toast.success(message);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <AppShell title="Account" subtitle="Your TradeX account">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Profile header — simple like Quotex */}
        <div className="flex items-center gap-4 rounded-card border border-border bg-card p-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl font-bold text-accent-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">{profile?.full_name || "Trader"}</p>
            <p className="truncate text-sm text-muted-foreground">{profile?.email}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 text-mint">
                <ShieldCheck className="h-3.5 w-3.5" />
                {me?.kyc?.status === "approved" ? "Verified" : "Standard account"}
              </span>
              {me?.isAdmin ? (
                <span className="inline-flex items-center gap-1 text-sky">
                  <BadgeCheck className="h-3.5 w-3.5" /> Admin
                </span>
              ) : null}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="mr-1.5 h-4 w-4" /> Log out
          </Button>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-card border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Demo balance</p>
            <p className="mt-1 text-xl font-semibold text-sky">{fmt(Number(demo?.balance ?? 0))}</p>
          </div>
          <div className="rounded-card border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Live balance</p>
            <p className="mt-1 text-xl font-semibold text-mint">{fmt(Number(live?.balance ?? 0))}</p>
          </div>
        </div>

        {/* Personal data */}
        <Panel title="Personal data">
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-sm text-muted-foreground">Full name</span>
              <Input value={text("full_name")} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-muted-foreground">Country</span>
              <Input value={text("country")} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-muted-foreground">Phone</span>
              <Input value={text("phone")} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <Button
              disabled={busy}
              onClick={() =>
                persist(
                  { full_name: text("full_name"), phone: text("phone") || null, country: text("country") || null },
                  "Personal data saved.",
                )
              }
            >
              Save
            </Button>
          </div>
        </Panel>

        {/* Notifications */}
        <Panel title="Notifications">
          <div className="space-y-3 text-sm">
            {(
              [
                ["notify_email", "Email notifications"],
                ["notify_trade_alerts", "Trade alerts"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span>{label}</span>
                <Switch
                  checked={Boolean(profile?.[key])}
                  disabled={busy}
                  onCheckedChange={(checked) => persist({ [key]: checked }, "Preference saved.")}
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
