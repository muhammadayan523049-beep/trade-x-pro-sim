import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { money, num, signedMoney, dateTime } from "@/lib/format";
import type { EnrichedPosition, OrderRow, PositionRow } from "@/lib/trading-engine";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[var(--radius-card)] border border-border bg-card", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "up" | "down";
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "num mt-1.5 font-display text-2xl font-semibold",
          tone === "up" && "text-up",
          tone === "down" && "text-down",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return (
    <th className={cn("whitespace-nowrap px-3 py-2 text-xs font-medium text-muted-foreground", right && "text-right")}>
      {children}
    </th>
  );
}

export function Td({ children, right, className }: { children: ReactNode; right?: boolean; className?: string }) {
  return (
    <td className={cn("whitespace-nowrap px-3 py-2.5 text-sm", right && "text-right", className)}>{children}</td>
  );
}

export function SideTag({ side }: { side: "buy" | "sell" }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-xs font-semibold uppercase",
        side === "buy" ? "bg-up/15 text-up" : "bg-down/15 text-down",
      )}
    >
      {side}
    </span>
  );
}

export function StatusTag({ status }: { status: string }) {
  const tone =
    status === "filled" || status === "completed" || status === "approved" || status === "open"
      ? "bg-up/15 text-up"
      : status === "pending" || status === "not_started"
        ? "bg-muted text-muted-foreground"
        : status === "rejected" || status === "cancelled"
          ? "bg-down/15 text-down"
          : "bg-secondary text-secondary-foreground";
  return <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium capitalize", tone)}>{status.replace("_", " ")}</span>;
}

export function PositionsTable({
  positions,
  digitsFor,
  onClose,
  onModify,
  busyId,
}: {
  positions: EnrichedPosition[];
  digitsFor: (symbol: string) => number;
  onClose?: (id: string) => void;
  onModify?: (position: EnrichedPosition) => void;
  busyId?: string | null;
}) {
  if (positions.length === 0) return <Empty>No open positions. Place a trade from the terminal.</Empty>;
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-160 border-collapse">
        <thead>
          <tr className="border-b border-border text-left">
            <Th>Symbol</Th>
            <Th>Side</Th>
            <Th right>Size</Th>
            <Th right>Entry</Th>
            <Th right>Market</Th>
            <Th right>SL / TP</Th>
            <Th right>Margin</Th>
            <Th right>P/L</Th>
            {(onClose || onModify) && <Th right>Action</Th>}
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr key={p.id} className="border-b border-border/60 last:border-0">
              <Td className="font-medium">{p.symbol}</Td>
              <Td>
                <SideTag side={p.side} />
              </Td>
              <Td right>
                <span className="num">{num(Number(p.quantity), 2)}</span>
              </Td>
              <Td right>
                <span className="num">{num(Number(p.entry_price), digitsFor(p.symbol))}</span>
              </Td>
              <Td right>
                <span className="num">{num(p.currentPrice, digitsFor(p.symbol))}</span>
              </Td>
              <Td right>
                <span className="num text-xs text-muted-foreground">
                  {p.stop_loss ? num(Number(p.stop_loss), digitsFor(p.symbol)) : "—"} /{" "}
                  {p.take_profit ? num(Number(p.take_profit), digitsFor(p.symbol)) : "—"}
                </span>
              </Td>
              <Td right>
                <span className="num">{money(Number(p.margin))}</span>
              </Td>
              <Td right>
                <span className={cn("num font-medium", p.pl >= 0 ? "text-up" : "text-down")}>
                  {signedMoney(p.pl)}
                </span>
              </Td>
              {(onClose || onModify) && (
                <Td right>
                  <div className="flex justify-end gap-1.5">
                    {onModify && (
                      <Button size="sm" variant="outline" onClick={() => onModify(p)}>
                        Edit
                      </Button>
                    )}
                    {onClose && (
                      <Button size="sm" variant="secondary" disabled={busyId === p.id} onClick={() => onClose(p.id)}>
                        Close
                      </Button>
                    )}
                  </div>
                </Td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClosedTable({ rows, digitsFor }: { rows: PositionRow[]; digitsFor: (s: string) => number }) {
  if (rows.length === 0) return <Empty>No closed trades yet.</Empty>;
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-140 border-collapse">
        <thead>
          <tr className="border-b border-border text-left">
            <Th>Symbol</Th>
            <Th>Side</Th>
            <Th right>Size</Th>
            <Th right>Entry</Th>
            <Th right>Exit</Th>
            <Th right>Closed</Th>
            <Th right>Realized</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-border/60 last:border-0">
              <Td className="font-medium">{p.symbol}</Td>
              <Td>
                <SideTag side={p.side} />
              </Td>
              <Td right>
                <span className="num">{num(Number(p.quantity), 2)}</span>
              </Td>
              <Td right>
                <span className="num">{num(Number(p.entry_price), digitsFor(p.symbol))}</span>
              </Td>
              <Td right>
                <span className="num">{p.close_price ? num(Number(p.close_price), digitsFor(p.symbol)) : "—"}</span>
              </Td>
              <Td right>
                <span className="text-xs text-muted-foreground">{dateTime(p.closed_at)}</span>
              </Td>
              <Td right>
                <span className={cn("num font-medium", Number(p.realized_pl ?? 0) >= 0 ? "text-up" : "text-down")}>
                  {signedMoney(Number(p.realized_pl ?? 0))}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OrdersTable({
  orders,
  digitsFor,
  onCancel,
}: {
  orders: OrderRow[];
  digitsFor: (s: string) => number;
  onCancel?: (id: string) => void;
}) {
  if (orders.length === 0) return <Empty>No orders yet.</Empty>;
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-160 border-collapse">
        <thead>
          <tr className="border-b border-border text-left">
            <Th>Placed</Th>
            <Th>Symbol</Th>
            <Th>Type</Th>
            <Th>Side</Th>
            <Th right>Size</Th>
            <Th right>Trigger</Th>
            <Th right>Fill</Th>
            <Th right>Status</Th>
            {onCancel && <Th right>Action</Th>}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-border/60 last:border-0">
              <Td>
                <span className="text-xs text-muted-foreground">{dateTime(o.created_at)}</span>
              </Td>
              <Td className="font-medium">{o.symbol}</Td>
              <Td className="capitalize">{o.kind}</Td>
              <Td>
                <SideTag side={o.side} />
              </Td>
              <Td right>
                <span className="num">{num(Number(o.quantity), 2)}</span>
              </Td>
              <Td right>
                <span className="num">
                  {o.limit_price || o.stop_price
                    ? num(Number(o.limit_price ?? o.stop_price), digitsFor(o.symbol))
                    : "—"}
                </span>
              </Td>
              <Td right>
                <span className="num">{o.filled_price ? num(Number(o.filled_price), digitsFor(o.symbol)) : "—"}</span>
              </Td>
              <Td right>
                <StatusTag status={o.status} />
              </Td>
              {onCancel && (
                <Td right>
                  {o.status === "pending" ? (
                    <Button size="sm" variant="outline" onClick={() => onCancel(o.id)}>
                      Cancel
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </Td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface TxRow {
  id: string;
  type: string;
  amount: number;
  status: string;
  method: string | null;
  note: string | null;
  created_at: string;
}

export function TransactionsTable({ rows }: { rows: TxRow[] }) {
  if (rows.length === 0) return <Empty>No transactions yet.</Empty>;
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-140 border-collapse">
        <thead>
          <tr className="border-b border-border text-left">
            <Th>Date</Th>
            <Th>Type</Th>
            <Th>Method</Th>
            <Th right>Amount</Th>
            <Th right>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-b border-border/60 last:border-0">
              <Td>
                <span className="text-xs text-muted-foreground">{dateTime(t.created_at)}</span>
              </Td>
              <Td className="capitalize">{t.type}</Td>
              <Td>
                <span className="text-xs text-muted-foreground">{t.method ?? "—"}</span>
              </Td>
              <Td right>
                <span className={cn("num font-medium", Number(t.amount) >= 0 ? "text-up" : "text-down")}>
                  {signedMoney(Number(t.amount))}
                </span>
              </Td>
              <Td right>
                <StatusTag status={t.status} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
