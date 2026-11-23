export type Currency = "CAD" | "USD";

const formatters: Record<Currency, Intl.NumberFormat> = {
  CAD: new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }),
  USD: new Intl.NumberFormat("en-CA", { style: "currency", currency: "USD" }),
};

export function money(value: number | null | undefined, currency: Currency = "CAD"): string {
  return value === null || value === undefined ? "—" : formatters[currency].format(value);
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Sums `pick(row)` per currency, for rows that pass `when`. */
export function totalsByCurrency<T extends { currency: Currency }>(
  rows: T[],
  pick: (row: T) => number,
  when: (row: T) => boolean = () => true,
): Record<Currency, number> {
  const out: Record<Currency, number> = { CAD: 0, USD: 0 };
  for (const row of rows) if (when(row)) out[row.currency] = round2(out[row.currency] + pick(row));
  return out;
}

/** "$1.00 + US$2.00", leaving out a currency with nothing in it. */
export function mixedMoney(totals: Record<Currency, number>): string {
  const parts = (Object.keys(totals) as Currency[])
    .filter((c) => totals[c] !== 0)
    .map((c) => money(totals[c], c));
  return parts.length ? parts.join(" + ") : money(0);
}

export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
