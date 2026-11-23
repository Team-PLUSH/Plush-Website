import type { Item, Member, Order } from "@/plush/admin.functions";

import { round2 } from "./format";

/** True for a team item bought as part of a bundle (its price is on the order). */
export const isBundleItem = (i: Item) => i.source === "team" && i.total === 0;

/**
 * Money saved on one item bought from a team instead of retail. 0 if the
 * retail price isn't known, or if the item was part of a bundle: a bundle's
 * savings can only be worked out from its order (see teamSavings).
 */
export const itemSavings = (i: Item) =>
  i.source === "team" && i.retailPrice !== null && !isBundleItem(i)
    ? round2((i.retailPrice - i.cost) * i.quantity)
    : 0;

/** Lower-cased names of the teams we bought items from. */
export const teamSupplierSet = (items: Item[]) =>
  new Set(items.filter((i) => i.source === "team").map((i) => i.supplier.trim().toLowerCase()));

/**
 * Money saved by buying from other teams, per currency: the retail value of
 * team items (where known) minus what we paid for them. What we paid is the
 * items' own prices plus any bundle order from that team.
 */
export function teamSavings(items: Item[], orders: Order[]) {
  const teams = teamSupplierSet(items);
  const out = { CAD: 0, USD: 0 };
  for (const i of items) {
    if (i.source !== "team") continue;
    out[i.currency] += (i.retailPrice ?? 0) * i.quantity - i.total;
  }
  for (const o of orders) {
    if (teams.has(o.supplier.trim().toLowerCase())) out[o.currency] -= o.total;
  }
  return { CAD: round2(out.CAD), USD: round2(out.USD) };
}

/** Where a member stands on their fee. */
export function memberStatus(m: Member): "Waived" | "Paid" | "Partial" | "Unpaid" {
  if (m.waived) return "Waived";
  if (m.amountPaid >= m.amountDue) return "Paid";
  return m.amountPaid > 0 ? "Partial" : "Unpaid";
}
/** What a member still owes (0 if waived or paid). */
export const memberOwing = (m: Member) =>
  m.waived ? 0 : Math.max(0, round2(m.amountDue - m.amountPaid));
