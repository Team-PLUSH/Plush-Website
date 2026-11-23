import type { Item, Member } from "@/plush/admin.functions";

import { round2 } from "./format";

/** Money saved by buying from a team instead of retail (0 if not known). */
export const itemSavings = (i: Item) =>
  i.source === "team" && i.retailPrice !== null ? round2((i.retailPrice - i.cost) * i.quantity) : 0;

/** Where a member stands on their fee. */
export function memberStatus(m: Member): "Waived" | "Paid" | "Partial" | "Unpaid" {
  if (m.waived) return "Waived";
  if (m.amountPaid >= m.amountDue) return "Paid";
  return m.amountPaid > 0 ? "Partial" : "Unpaid";
}
/** What a member still owes (0 if waived or paid). */
export const memberOwing = (m: Member) =>
  m.waived ? 0 : Math.max(0, round2(m.amountDue - m.amountPaid));
