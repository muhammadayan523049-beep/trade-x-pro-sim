import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface DepositAddressRow {
  id: string;
  network: string;
  address: string;
  memo: string | null;
  instructions: string | null;
  is_active: boolean;
  sort_order: number;
}

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden — admin access required.");
}

export const listDepositAddresses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    const { data } = await supabase
      .from("deposit_addresses")
      .select("id,network,address,memo,instructions,is_active,sort_order")
      .order("sort_order");
    return { addresses: (data ?? []) as DepositAddressRow[] };
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  network: z.string().trim().min(1).max(60),
  address: z.string().trim().min(4).max(200),
  memo: z.string().trim().max(120).optional().default(""),
  instructions: z.string().trim().max(400).optional().default(""),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(999).optional().default(0),
});

export const saveDepositAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    await assertAdmin(supabase, context.userId);

    const row = {
      network: data.network,
      address: data.address,
      memo: data.memo || null,
      instructions: data.instructions || null,
      is_active: data.isActive,
      sort_order: data.sortOrder,
    };

    if (data.id) {
      const { error } = await supabase.from("deposit_addresses").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("deposit_addresses").insert(row);
      if (error) throw new Error(error.message);
    }

    await supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: data.id ? "deposit_address.update" : "deposit_address.create",
      entity: "deposit_addresses",
      entity_id: data.id ?? null,
      meta: { network: data.network },
    });

    return { ok: true };
  });

export const deleteDepositAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    await assertAdmin(supabase, context.userId);
    const { error } = await supabase.from("deposit_addresses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
