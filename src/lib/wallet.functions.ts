import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export const getWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    const userId = context.userId;

    const [accounts, transactions, methods] = await Promise.all([
      supabase.from("accounts").select("*").eq("user_id", userId).order("type"),
      supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
      supabase.from("payment_methods").select("*").eq("user_id", userId).order("created_at"),
    ]);

    return {
      accounts: accounts.data ?? [],
      transactions: transactions.data ?? [],
      methods: methods.data ?? [],
    };
  });

const moveSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.number().min(1).max(1_000_000),
  method: z.string().trim().min(1).max(60),
});

export const requestDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => moveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    const userId = context.userId;

    const { data: account } = await supabase
      .from("accounts")
      .select("id,type,balance")
      .eq("id", data.accountId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!account) throw new Error("Account not found.");
    const acct = account as { id: string; type: string; balance: number };

    // Demo accounts are topped up instantly with simulated funds.
    const instant = acct.type === "demo";
    const { data: tx, error } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        account_id: acct.id,
        type: "deposit",
        amount: data.amount,
        status: instant ? "completed" : "pending",
        method: data.method,
        note: "Simulated deposit — no real funds are moved.",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (instant) {
      await supabase
        .from("accounts")
        .update({ balance: Number(acct.balance) + data.amount })
        .eq("id", acct.id);
    }

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "wallet.deposit",
      entity: "transactions",
      entity_id: (tx as { id: string }).id,
      meta: { amount: data.amount, method: data.method, instant },
    });

    return { ok: true, instant };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => moveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    const userId = context.userId;

    const { data: account } = await supabase
      .from("accounts")
      .select("id,type,balance")
      .eq("id", data.accountId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!account) throw new Error("Account not found.");
    const acct = account as { id: string; type: string; balance: number };

    const { data: openRows } = await supabase
      .from("positions")
      .select("margin")
      .eq("account_id", acct.id)
      .eq("status", "open");
    const usedMargin = (openRows ?? []).reduce(
      (sum: number, r) => sum + Number((r as { margin?: number }).margin ?? 0),
      0,
    );
    if (data.amount > Number(acct.balance) - usedMargin) {
      throw new Error("Amount exceeds your available (non-margin) balance.");
    }

    const { data: tx, error } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        account_id: acct.id,
        type: "withdrawal",
        amount: -Math.abs(data.amount),
        status: "pending",
        method: data.method,
        note: "Simulated withdrawal — awaiting review.",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "wallet.withdraw",
      entity: "transactions",
      entity_id: (tx as { id: string }).id,
      meta: { amount: data.amount, method: data.method },
    });

    return { ok: true };
  });

export const savePaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        label: z.string().trim().min(2).max(60),
        kind: z.enum(["card", "bank", "wallet"]),
        last4: z.string().trim().regex(/^\d{4}$/, "Enter the last 4 digits"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    const { error } = await supabase.from("payment_methods").insert({
      user_id: context.userId,
      label: data.label,
      kind: data.kind,
      last4: data.last4,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    await supabase.from("payment_methods").delete().eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });
