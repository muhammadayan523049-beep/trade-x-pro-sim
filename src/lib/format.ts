export function money(value: number | null | undefined, currency = "USD"): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function signedMoney(value: number | null | undefined, currency = "USD"): string {
  const n = Number(value ?? 0);
  return `${n >= 0 ? "+" : "-"}${money(Math.abs(n), currency)}`;
}

export function num(value: number | null | undefined, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value ?? 0));
}

export function pct(value: number | null | undefined, digits = 2): string {
  const n = Number(value ?? 0);
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function dateTime(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dateOnly(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function initials(name: string, email: string): string {
  const source = name?.trim() || email || "";
  const parts = source.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join("") || "TX").toUpperCase();
}
