import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import {
  Bell,
  CandlestickChart,
  Gauge,
  LayoutGrid,
  LogOut,
  Menu,
  PieChart,
  Settings,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getMe, markNotificationsRead } from "@/lib/account.functions";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/terminal", label: "Terminal", icon: CandlestickChart },
  { to: "/markets", label: "Markets", icon: LayoutGrid },
  { to: "/portfolio", label: "Portfolio", icon: PieChart },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/verification", label: "Verification", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function useMe() {
  const fetchMe = useServerFn(getMe);
  return useQuery({ queryKey: ["me"], queryFn: () => fetchMe(), staleTime: 15_000 });
}

export function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const markRead = useServerFn(markNotificationsRead);
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const unread = (me?.notifications ?? []).filter((n) => !n.is_read).length;
  const name = me?.profile?.full_name || "";
  const email = me?.profile?.email || "";

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-sidebar px-4 py-5 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-bold tracking-tight">
            Trade<span className="text-accent">X</span>
          </Link>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" }}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
          {me?.isAdmin && (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: "bg-secondary text-secondary-foreground" }}
            >
              <ShieldCheck className="size-4" />
              Admin console
            </Link>
          )}
        </nav>

        <div className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
          Simulated broker. All prices, orders and balances are paper trading only.
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur sm:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold sm:text-xl">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>

          <div className="relative">
            <button
              className="relative rounded-full border border-border p-2 hover:bg-muted"
              aria-label="Notifications"
              onClick={() => {
                setNotifOpen((v) => !v);
                if (unread > 0) {
                  void markRead().then(() => queryClient.invalidateQueries({ queryKey: ["me"] }));
                }
              }}
            >
              <Bell className="size-4" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
                  {unread}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-11 z-30 w-80 rounded-xl border border-border bg-popover p-2 shadow-[var(--shadow-float)]">
                {(me?.notifications ?? []).length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">No notifications yet.</p>
                )}
                {(me?.notifications ?? []).slice(0, 8).map((n) => (
                  <div key={n.id} className="rounded-lg p-3 hover:bg-muted">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials(name, email)}
            </span>
            <span className="hidden max-w-32 truncate text-sm sm:block">{name || email}</span>
            <button onClick={signOut} aria-label="Sign out" className="text-muted-foreground hover:text-foreground">
              <LogOut className="size-4" />
            </button>
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
