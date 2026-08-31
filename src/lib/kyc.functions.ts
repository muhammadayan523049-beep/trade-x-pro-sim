import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export const getKyc = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    const { data } = await supabase
      .from("kyc_submissions")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data;
  });

const kycSchema = z.object({
  first_name: z.string().trim().min(1).max(60),
  last_name: z.string().trim().min(1).max(60),
  date_of_birth: z.string().trim().min(4).max(20),
  nationality: z.string().trim().min(2).max(60),
  address_line1: z.string().trim().min(3).max(120),
  address_line2: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().min(1).max(60),
  postal_code: z.string().trim().min(2).max(20),
  country: z.string().trim().min(2).max(60),
  document_type: z.enum(["passport", "id_card", "drivers_license"]),
  document_number: z.string().trim().min(4).max(40),
  document_ref: z.string().trim().max(200).optional().default(""),
  proof_of_address_ref: z.string().trim().max(200).optional().default(""),
});

export const submitKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => kycSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseClient;
    const userId = context.userId;

    // MVP: documents are never processed or stored — only a filename reference is kept.
    const { error } = await supabase
      .from("kyc_submissions")
      .upsert(
        {
          user_id: userId,
          ...data,
          status: "pending",
          review_note: null,
          submitted_at: new Date().toISOString(),
          reviewed_at: null,
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "kyc.submit",
      entity: "kyc_submissions",
      entity_id: userId,
      meta: { document_type: data.document_type },
    });

    await supabase.from("notifications").insert({
      user_id: userId,
      title: "Verification submitted",
      body: "Your details are in review. This is a demo flow — no identity documents are processed.",
    });

    return { ok: true };
  });
