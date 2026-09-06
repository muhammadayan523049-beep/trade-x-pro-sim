import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Panel } from "@/components/trading-ui";
import { listDepositAddresses, type DepositAddressRow } from "@/lib/deposit-address.functions";

export function useDepositAddresses() {
  const fetchAddresses = useServerFn(listDepositAddresses);
  return useQuery({
    queryKey: ["deposit-addresses"],
    queryFn: () => fetchAddresses(),
    refetchInterval: 60_000,
  });
}

export function DepositAddresses() {
  const { data } = useDepositAddresses();
  const addresses = ((data?.addresses ?? []) as DepositAddressRow[]).filter((a) => a.is_active);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Address copied.");
    } catch {
      toast.error("Could not copy — select the text manually.");
    }
  }

  return (
    <Panel title="Deposit addresses">
      {addresses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No deposit address is published yet.</p>
      ) : (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{a.network}</p>
              <div className="mt-1.5 flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all text-sm">{a.address}</code>
                <button aria-label={`Copy ${a.network} address`} onClick={() => copy(a.address)}>
                  <Copy className="size-4 text-muted-foreground" />
                </button>
              </div>
              {a.memo && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Memo / tag: <span className="break-all text-foreground">{a.memo}</span>
                </p>
              )}
              {a.instructions && <p className="mt-1 text-xs text-muted-foreground">{a.instructions}</p>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
