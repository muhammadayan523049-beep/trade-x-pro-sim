import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, useMe } from "@/components/AppShell";
import { Panel } from "@/components/trading-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateProfile } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — TradeX" },
      { name: "description", content: "Manage your TradeX profile, trading defaults and notification preferences." },
      { property: "og:title", content: "TradeX settings" },
      { property: "og:description", content: "Profile, trading defaults and notification preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: me } = useMe();
  const save = useServerFn(updateProfile);
  const queryClient = useQueryClient();
  const profile = me?.profile as
    | {
        full_name: string;
        phone: string | null;
        country: string | null;
        notify_email: boolean;
        notify_push: boolean;
        notify_trade_alerts: boolean;
        default_lots: number;
        default_leverage: number;
      }
    | null
    | undefined;

  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const text = (key: "full_name" | "phone" | "country") =>
    form[key] ?? (profile?.[key] ?? "") ?? "";

  async function persist(patch: Record<string, unknown>) {
    setBusy(true);
    try {
      await save({ data: patch as never });
      toast.success("Settings saved.");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Settings" subtitle="Profile, trading defaults and notifications">
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Profile">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                value={text("full_name")}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={text("phone")} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={text("country")}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </div>
            <Button
              disabled={busy}
              onClick={() =>
                persist({
                  full_name: text("full_name"),
                  phone: text("phone") || null,
                  country: text("country") || null,
                })
              }
            >
              Save profile
            </Button>
            <p className="text-xs text-muted-foreground">Signed in as {me?.profile?.email}</p>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Trading defaults">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="lots">Default size (lots)</Label>
                <Input
                  id="lots"
                  inputMode="decimal"
                  value={form["default_lots"] ?? String(profile?.default_lots ?? "0.10")}
                  onChange={(e) => setForm({ ...form, default_lots: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lev">Default leverage</Label>
                <Input
                  id="lev"
                  inputMode="numeric"
                  value={form["default_leverage"] ?? String(profile?.default_leverage ?? 100)}
                  onChange={(e) => setForm({ ...form, default_leverage: e.target.value })}
                />
              </div>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  persist({
                    default_lots: Number(form["default_lots"] ?? profile?.default_lots ?? 0.1),
                    default_leverage: Number(form["default_leverage"] ?? profile?.default_leverage ?? 100),
                  })
                }
              >
                Save defaults
              </Button>
            </div>
          </Panel>

          <Panel title="Notifications">
            <div className="space-y-3 text-sm">
              {(
                [
                  ["notify_email", "Email notifications"],
                  ["notify_push", "Push notifications"],
                  ["notify_trade_alerts", "Trade alerts"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span>{label}</span>
                  <Switch
                    checked={Boolean(profile?.[key])}
                    disabled={busy}
                    onCheckedChange={(checked) => persist({ [key]: checked })}
                  />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
