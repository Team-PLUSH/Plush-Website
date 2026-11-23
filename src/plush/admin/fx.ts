import type { AdminDoc, FxRate } from "@/plush/admin.functions";

import { round2 } from "./format";

// The admin's "Show in CAD" view: a copy of the data with every USD amount
// converted at the Bank of Canada rate for that row's own date (the last
// business day on or before it). Display only — the page turns editing off
// while it's on, so converted numbers are never saved back.

/** CAD per 1 USD on `date`: the last published rate on or before it. */
export function rateOn(rates: FxRate[], date: string | null | undefined): number {
  if (rates.length === 0) return 1;
  if (!date) return rates[rates.length - 1][1];
  let lo = 0;
  let hi = rates.length - 1;
  if (date < rates[0][0]) return rates[0][1];
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (rates[mid][0] <= date) lo = mid;
    else hi = mid - 1;
  }
  return rates[lo][1];
}

/** Earliest date on any USD row, so only the rates we need are fetched. */
export function earliestUsdDate(doc: AdminDoc, today: string): string | null {
  const dates = [
    ...doc.items.filter((r) => r.currency === "USD").map((r) => r.date),
    ...doc.orders.filter((r) => r.currency === "USD").map((r) => r.date),
    ...doc.expenses.filter((r) => r.currency === "USD").map((r) => r.date),
    ...doc.income.filter((r) => r.currency === "USD").map((r) => r.dateReceived ?? r.dateApplied),
  ];
  if (dates.length === 0) return null;
  const known = dates.filter((d): d is string => Boolean(d)).sort();
  return known[0] ?? today;
}

export function hasUsd(doc: AdminDoc): boolean {
  return [doc.items, doc.orders, doc.expenses, doc.income].some((rows) =>
    rows.some((r) => r.currency === "USD"),
  );
}

function convert<T extends { currency: "CAD" | "USD" }>(
  row: T,
  rate: number,
  fields: (keyof T)[],
): T {
  if (row.currency !== "USD") return row;
  const out = { ...row, currency: "CAD" as const };
  for (const f of fields) {
    const v = row[f];
    if (typeof v === "number") (out as Record<keyof T, unknown>)[f] = round2(v * rate);
  }
  return out;
}

/** The whole document with USD amounts converted to CAD, row by row. */
export function toCad(doc: AdminDoc, rates: FxRate[]): AdminDoc {
  return {
    ...doc,
    items: doc.items.map((r) =>
      convert(r, rateOn(rates, r.date), ["cost", "total", "retailPrice"]),
    ),
    orders: doc.orders.map((r) =>
      convert(r, rateOn(rates, r.date), ["subtotal", "shipping", "tax", "otherFees", "total"]),
    ),
    expenses: doc.expenses.map((r) =>
      convert(r, rateOn(rates, r.date), ["amount", "tax", "total"]),
    ),
    income: doc.income.map((r) =>
      convert(r, rateOn(rates, r.dateReceived ?? r.dateApplied), ["amount"]),
    ),
  };
}
