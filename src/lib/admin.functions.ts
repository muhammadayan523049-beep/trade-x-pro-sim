import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden — admin access required.");
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    await assertAdmin(supabase, context.userId);

    const [profiles, roles, kyc, accounts, transactions, positions, orders, logs] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("user_roles").select("user_id,role"),
      supabase.from("kyc_submissions").select("*").order("submitted_at", { ascending: false }).limit(500),
      supabase.from("accounts").select("*"),
      supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("positions").select("*").order("opened_at", { ascending: false }).limit(500),
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
    ]);

    return {
      profiles: profiles.data ?? [],
      roles: roles.data ?? [],
      kyc: kyc.data ?? [],
      accounts: accounts.data ?? [],
      transactions: transactions.data ?? [],
      positions: positions.data ?? [],
      orders: orders.data ?? [],
      logs: logs.data ?? [],
    };
  });

export const reviewKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        status: z.enum(["approved", "rejected", "pending"]),
        note: z.string().trim().max(400).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    await assertAdmin(supabase, context.userId);

    const { error } = await supabase
      .from("kyc_submissions")
      .update({ status: data.status, review_note: data.note, reviewed_at: new Date().toISOString() })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);

    await supabase.from("notifications").insert({
      user_id: data.userId,
      title: `Verification ${data.status}`,
      body: data.note || `Your verification was ${data.status}.`,
    });
    await supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: `kyc.${data.status}`,
      entity: "kyc_submissions",
      entity_id: data.userId,
      meta: { note: data.note },
    });
    return { ok: true };
  });

export const reviewTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ transactionId: z.string().uuid(), status: z.enum(["completed", "rejected"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    await assertAdmin(supabase, context.userId);

    const { data: row } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!row) throw new Error("Transaction not found.");
    const tx = row as { id: string; user_id: string; account_id: string; amount: number; status: string };
    if (tx.status !== "pending") throw new Error("This transaction has already been reviewed.");

    await supabase.from("transactions").update({ status: data.status }).eq("id", tx.id);

    if (data.status === "completed") {
      const { data: account } = await supabase
        .from("accounts")
        .select("balance")
        .eq("id", tx.account_id)
        .maybeSingle();
      const balance = Number((account as { balance?: number } | null)?.balance ?? 0);
      await supabase
        .from("accounts")
        .update({ balance: Math.round((balance + Number(tx.amount)) * 100) / 100 })
        .eq("id", tx.account_id);
    }

    await supabase.from("notifications").insert({
      user_id: tx.user_id,
      title: `Funds request ${data.status}`,
      body: `Your simulated request for ${Math.abs(Number(tx.amount)).toFixed(2)} USD was ${data.status}.`,
    });
    await supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: `transaction.${data.status}`,
      entity: "transactions",
      entity_id: tx.id,
      meta: { amount: tx.amount },
    });
    return { ok: true };
  });

export const setUserSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), suspended: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    await assertAdmin(supabase, context.userId);

    const { error } = await supabase.from("profiles").update({ is_suspended: data.suspended }).eq("id", data.userId);
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: data.suspended ? "user.suspend" : "user.reinstate",
      entity: "profiles",
      entity_id: data.userId,
      meta: {},
    });
    return { ok: true };
  });

export const setInstrumentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ symbol: z.string().trim().min(1).max(20), tradable: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    await assertAdmin(supabase, context.userId);

    const { error } = await supabase
      .from("instruments")
      .update({ is_tradable: data.tradable })
      .eq("symbol", data.symbol);
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: "instrument.status",
      entity: "instruments",
      entity_id: data.symbol,
      meta: { tradable: data.tradable },
    });
    return { ok: true };
  });

export const adjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        accountId: z.string().uuid(),
        amount: z.number().finite().min(-1_000_000).max(1_000_000),
        note: z.string().trim().max(200).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    await assertAdmin(supabase, context.userId);

    const { data: account } = await supabase
      .from("accounts")
      .select("id,user_id,balance")
      .eq("id", data.accountId)
      .maybeSingle();
    if (!account) throw new Error("Account not found.");
    const row = account as { id: string; user_id: string; balance: number };

    const next = Math.round((Number(row.balance) + data.amount) * 100) / 100;
    if (next < 0) throw new Error("Adjustment would make the balance negative.");

    const { error } = await supabase.from("accounts").update({ balance: next }).eq("id", row.id);
    if (error) throw new Error(error.message);

    await supabase.from("transactions").insert({
      user_id: row.user_id,
      account_id: row.id,
      type: "adjustment",
      amount: data.amount,
      status: "completed",
      method: "admin",
      note: data.note || "Admin balance adjustment",
    });
    await supabase.from("notifications").insert({
      user_id: row.user_id,
      title: "Balance adjusted",
      body: `An administrator adjusted your account balance by ${data.amount.toFixed(2)} USD.`,
    });
    await supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: "account.adjust",
      entity: "accounts",
      entity_id: row.id,
      meta: { amount: data.amount, note: data.note },
    });
    return { ok: true, balance: next };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), admin: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    await assertAdmin(supabase, context.userId);

    if (data.userId === context.userId && !data.admin) {
      throw new Error("You cannot remove your own admin access.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.admin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }

    await supabase.from("notifications").insert({
      user_id: data.userId,
      title: data.admin ? "Admin access granted" : "Admin access removed",
      body: data.admin
        ? "You now have administrator control of the platform."
        : "Your administrator access has been removed.",
    });
    await supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: data.admin ? "role.grant_admin" : "role.revoke_admin",
      entity: "user_roles",
      entity_id: data.userId,
      meta: {},
    });
    return { ok: true };
  });

