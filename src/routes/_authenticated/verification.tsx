import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Panel, StatusTag } from "@/components/trading-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dateTime } from "@/lib/format";
import { getKyc, submitKyc } from "@/lib/kyc.functions";

export const Route = createFileRoute("/_authenticated/verification")({
  head: () => ({
    meta: [
      { title: "Verification — TradeX" },
      { name: "description", content: "Complete the simulated KYC verification flow for your TradeX paper-trading account." },
      { property: "og:title", content: "TradeX verification" },
      { property: "og:description", content: "A demo identity verification workflow — no documents are processed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerificationPage,
});

const FIELDS = [
  ["first_name", "First name"],
  ["last_name", "Last name"],
  ["date_of_birth", "Date of birth (YYYY-MM-DD)"],
  ["nationality", "Nationality"],
  ["address_line1", "Address line 1"],
  ["address_line2", "Address line 2 (optional)"],
  ["city", "City"],
  ["postal_code", "Postal code"],
  ["country", "Country"],
  ["document_number", "Document number"],
] as const;

function VerificationPage() {
  const fetchKyc = useServerFn(getKyc);
  const submit = useServerFn(submitKyc);
  const queryClient = useQueryClient();
  const { data: kyc } = useQuery({ queryKey: ["kyc"], queryFn: () => fetchKyc() });

  const [form, setForm] = useState<Record<string, string>>({});
  const [docType, setDocType] = useState<"passport" | "id_card" | "drivers_license">("passport");
  const [busy, setBusy] = useState(false);

  const record = kyc as
    | { status: string; review_note: string | null; submitted_at: string | null; reviewed_at: string | null }
    | null
    | undefined;

  function value(key: string) {
    return form[key] ?? (record as unknown as Record<string, string | null> | null | undefined)?.[key] ?? "";
  }

  async function send() {
    setBusy(true);
    try {
      await submit({
        data: {
          first_name: value("first_name"),
          last_name: value("last_name"),
          date_of_birth: value("date_of_birth"),
          nationality: value("nationality"),
          address_line1: value("address_line1"),
          address_line2: value("address_line2"),
          city: value("city"),
          postal_code: value("postal_code"),
          country: value("country"),
          document_type: docType,
          document_number: value("document_number"),
        },
      });
      toast.success("Verification submitted for review.");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please check your details");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Verification" subtitle="Simulated KYC — no identity documents are processed">
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Panel title="Your details">
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  value={value(key)}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  maxLength={120}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="document_type">Document type</Label>
              <select
                id="document_type"
                value={docType}
                onChange={(e) => setDocType(e.target.value as typeof docType)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="passport">Passport</option>
                <option value="id_card">National ID card</option>
                <option value="drivers_license">Driver&apos;s licence</option>
              </select>
            </div>
          </div>
          <Button className="mt-4" disabled={busy} onClick={send}>
            Submit for review
          </Button>
        </Panel>

        <Panel title="Status">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Current status</span>
              <StatusTag status={record?.status ?? "not_started"} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Submitted</span>
              <span className="num">{record?.submitted_at ? dateTime(record.submitted_at) : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Reviewed</span>
              <span className="num">{record?.reviewed_at ? dateTime(record.reviewed_at) : "—"}</span>
            </div>
            {record?.review_note && <p className="rounded-lg bg-muted p-3 text-xs">{record.review_note}</p>}
            <p className="text-[11px] text-muted-foreground">
              This is a demonstration workflow. Never upload real identity documents.
            </p>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
