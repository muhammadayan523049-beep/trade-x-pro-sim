import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Panel } from "@/components/trading-ui";
import { useDepositAddresses } from "@/components/DepositAddresses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteDepositAddress,
  saveDepositAddress,
  type DepositAddressRow,
} from "@/lib/deposit-address.functions";

export function DepositAddressAdmin() {
  const { data } = useDepositAddresses();
  const saveFn = useServerFn(saveDepositAddress);
  const deleteFn = useServerFn(deleteDepositAddress);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Record<string, { network: string; address: string; memo: string }>>({});
  const [newRow, setNewRow] = useState({ network: "", address: "", memo: "" });

  const addresses = (data?.addresses ?? []) as DepositAddressRow[];

  function field(row: DepositAddressRow, key: "network" | "address" | "memo") {
    return draft[row.id]?.[key] ?? (key === "memo" ? (row.memo ?? "") : row[key]);
  }

  function edit(row: DepositAddressRow, key: "network" | "address" | "memo", value: string) {
    setDraft((prev) => ({
      ...prev,
      [row.id]: {
        network: prev[row.id]?.network ?? row.network,
        address: prev[row.id]?.address ?? row.address,
        memo: prev[row.id]?.memo ?? (row.memo ?? ""),
        [key]: value,
      },
    }));
  }

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      toast.success(message);
      await queryClient.invalidateQueries({ queryKey: ["deposit-addresses"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Deposit addresses — what users see when funding">
      <ul className="space-y-3">
        {addresses.map((row) => (
          <li key={row.id} className="space-y-2 rounded-lg border border-border p-3">
            <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
              <Input
                aria-label="Network"
                value={field(row, "network")}
                onChange={(e) => edit(row, "network", e.target.value)}
                maxLength={60}
              />
              <Input
                aria-label="Address"
                value={field(row, "address")}
                onChange={(e) => edit(row, "address", e.target.value)}
                maxLength={200}
              />
            </div>
            <Input
              aria-label="Memo or tag"
              placeholder="Memo / tag (optional)"
              value={field(row, "memo")}
              onChange={(e) => edit(row, "memo", e.target.value)}
              maxLength={120}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      saveFn({
                        data: {
                          id: row.id,
                          network: field(row, "network"),
                          address: field(row, "address"),
                          memo: field(row, "memo"),
                          instructions: row.instructions ?? "",
                          isActive: row.is_active,
                          sortOrder: row.sort_order,
                        },
                      }),
                    "Deposit address updated.",
                  )
                }
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      saveFn({
                        data: {
                          id: row.id,
                          network: field(row, "network"),
                          address: field(row, "address"),
                          memo: field(row, "memo"),
                          instructions: row.instructions ?? "",
                          isActive: !row.is_active,
                          sortOrder: row.sort_order,
                        },
                      }),
                    row.is_active ? "Hidden from users." : "Now visible to users.",
                  )
                }
              >
                {row.is_active ? "Hide" : "Show"}
              </Button>
              <button
                aria-label="Delete deposit address"
                disabled={busy}
                onClick={() => run(() => deleteFn({ data: { id: row.id } }), "Deposit address removed.")}
              >
                <Trash2 className="size-4 text-muted-foreground" />
              </button>
              <span className="text-xs text-muted-foreground">{row.is_active ? "Visible to users" : "Hidden"}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-2 rounded-lg border border-dashed border-border p-3">
        <Label>Add a new deposit address</Label>
        <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
          <Input
            placeholder="Network (e.g. USDT TRC20)"
            value={newRow.network}
            onChange={(e) => setNewRow({ ...newRow, network: e.target.value })}
            maxLength={60}
          />
          <Input
            placeholder="Wallet address"
            value={newRow.address}
            onChange={(e) => setNewRow({ ...newRow, address: e.target.value })}
            maxLength={200}
          />
        </div>
        <Input
          placeholder="Memo / tag (optional)"
          value={newRow.memo}
          onChange={(e) => setNewRow({ ...newRow, memo: e.target.value })}
          maxLength={120}
        />
        <Button
          variant="outline"
          disabled={busy || !newRow.network.trim() || newRow.address.trim().length < 4}
          onClick={() =>
            run(async () => {
              await saveFn({
                data: {
                  network: newRow.network,
                  address: newRow.address,
                  memo: newRow.memo,
                  instructions: "",
                  isActive: true,
                  sortOrder: addresses.length + 1,
                },
              });
              setNewRow({ network: "", address: "", memo: "" });
            }, "Deposit address added.")
          }
        >
          Add address
        </Button>
      </div>
    </Panel>
  );
}
