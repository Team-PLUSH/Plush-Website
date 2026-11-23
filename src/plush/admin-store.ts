// Server-only storage for the team admin data (inventory, orders, expenses,
// income, membership fees), in the project's Upstash Redis.
//
// Everything is one JSON document (it is small: ~150 bytes a row). Every change
// is read → modify → compare-and-set, so two people saving at the same moment
// can't overwrite each other: the second write sees the revision moved,
// re-reads, and re-applies its change on top. Before each write the previous
// document is pushed onto a history list (last 50 kept), so a bad import or
// delete can be recovered from the Upstash console.
//
// Nothing here is in the public repo's data: names and payments only ever live
// in Redis and are only sent to a signed-in browser.
//
// Only import this from inside server-function handlers.

import { z } from "zod";

import {
  CONDITIONS,
  CURRENCIES,
  EXPENSE_CATEGORIES,
  FEE_METHODS,
  INCOME_STATUSES,
  INCOME_TYPES,
  ITEM_CATEGORIES,
  ITEM_SOURCES,
  MEMBER_ROLES,
  PAYMENT_METHODS,
  RECURRENCE,
} from "./admin-options";
import { upstashPipeline, type UpstashConfig } from "./upstash";

const DOC_KEY = "plush:admin:v1";
const REV_KEY = "plush:admin:v1:rev";
const HISTORY_KEY = "plush:admin:v1:history";
const HISTORY_LENGTH = 50;

// KEYS: doc, rev, history.  ARGV: expected revision, new document.
// Returns the new revision, or 0 if someone else saved first.
const COMPARE_AND_SET = `
local rev = tonumber(redis.call('GET', KEYS[2]) or '0')
if rev ~= tonumber(ARGV[1]) then return 0 end
local cur = redis.call('GET', KEYS[1])
if cur then
  redis.call('LPUSH', KEYS[3], cur)
  redis.call('LTRIM', KEYS[3], 0, ${HISTORY_LENGTH - 1})
end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], tostring(rev + 1))
return rev + 1
`;

// KEYS: doc, rev. Returns [revision, document or ""].
const READ_BOTH = `
return { redis.call('GET', KEYS[2]) or '0', redis.call('GET', KEYS[1]) or '' }
`;

const money = z.number().finite().min(0).max(1_000_000);
const text = (max: number) => z.string().trim().min(1, "Required").max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
const isoDate = z
  .string()
  .trim()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Use YYYY-MM-DD")
  .nullish()
  .transform((v) => v || null);
const currency = z.enum(CURRENCIES);
const round2 = (n: number) => Math.round(n * 100) / 100;

const bool = z.boolean().default(false);
const pick = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values);
const optionalPick = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .enum(values)
    .or(z.literal(""))
    .nullish()
    .transform((v) => v || null);
const email = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "Not a valid email")
  .nullish()
  .transform((v) => v || null);

/** A part or tool the team bought. */
export const itemInputSchema = z
  .object({
    item: text(300),
    category: pick(ITEM_CATEGORIES).default("Other"),
    partNumber: optionalText(80),
    quantity: z.number().finite().positive().max(100_000),
    /** What we paid per unit, before tax. */
    cost: money,
    /** Line total before tax; cost × quantity if left out. */
    total: money.nullish(),
    currency,
    /** Bought from a store/vendor, or from another team. */
    source: pick(ITEM_SOURCES).default("retail"),
    /** The store, or the team (e.g. "FRC 8729 Sir Lancerbot"). */
    supplier: text(120),
    /** For team purchases: what it costs new, per unit, to show the discount. */
    retailPrice: money.nullish().transform((v) => v ?? null),
    condition: optionalPick(CONDITIONS),
    date: isoDate,
    orderNumber: optionalText(80),
    purchasedBy: optionalText(80),
    reimbursed: bool,
    location: optionalText(120),
    note: optionalText(400),
  })
  .transform((i) => ({ ...i, total: i.total ?? round2(i.cost * i.quantity) }));

/** One order or receipt (the money side of a purchase of items). */
export const orderInputSchema = z
  .object({
    supplier: text(120),
    orderNumber: optionalText(80),
    date: isoDate,
    currency,
    subtotal: money,
    shipping: money.nullish().transform((v) => v ?? null),
    tax: money.nullish().transform((v) => v ?? null),
    otherFees: money.nullish().transform((v) => v ?? null),
    /** Sum of the parts if left out. */
    total: money.nullish(),
    paymentMethod: optionalPick(PAYMENT_METHODS),
    paidBy: optionalText(80),
    reimbursed: bool,
    notes: optionalText(400),
  })
  .transform((o) => ({
    ...o,
    total: o.total ?? round2(o.subtotal + (o.shipping ?? 0) + (o.tax ?? 0) + (o.otherFees ?? 0)),
  }));

/** Spending that isn't a part: rent, competition fees, travel, software... */
export const expenseInputSchema = z
  .object({
    date: isoDate,
    category: pick(EXPENSE_CATEGORIES),
    description: text(300),
    payee: text(120),
    amount: money,
    tax: money.nullish().transform((v) => v ?? null),
    /** amount + tax if left out. */
    total: money.nullish(),
    currency,
    paymentMethod: optionalPick(PAYMENT_METHODS),
    paidBy: optionalText(80),
    reimbursed: bool,
    recurrence: pick(RECURRENCE).default("One-time"),
    reference: optionalText(80),
    notes: optionalText(400),
  })
  .transform((e) => ({ ...e, total: e.total ?? round2(e.amount + (e.tax ?? 0)) }));

/** Money coming in: grants, sponsorships, donations, fundraisers. */
export const incomeInputSchema = z.object({
  type: pick(INCOME_TYPES),
  source: text(160),
  /** Grant program name, or sponsorship tier. */
  program: optionalText(160),
  status: pick(INCOME_STATUSES),
  amount: money,
  currency,
  dateApplied: isoDate,
  dateReceived: isoDate,
  contactName: optionalText(120),
  contactEmail: email,
  /** What the money may be spent on, if restricted. */
  restrictions: optionalText(400),
  /** What we promised in return (logo on robot, shirt, social posts...). */
  recognition: optionalText(400),
  reportDue: isoDate,
  reference: optionalText(80),
  notes: optionalText(400),
});

/** One member's fee for one season. */
export const memberInputSchema = z.object({
  name: text(120),
  role: pick(MEMBER_ROLES).default("Student"),
  season: text(40),
  amountDue: money,
  amountPaid: money.default(0),
  paidDate: isoDate,
  method: optionalPick(FEE_METHODS),
  receivedBy: optionalText(80),
  waived: bool,
  contactEmail: email,
  notes: optionalText(300),
});

export const collectionSchemas = {
  items: itemInputSchema,
  orders: orderInputSchema,
  expenses: expenseInputSchema,
  income: incomeInputSchema,
  members: memberInputSchema,
} as const;

export type Collection = keyof typeof collectionSchemas;
export const COLLECTIONS = Object.keys(collectionSchemas) as Collection[];
export const COLLECTION_LIMITS: Record<Collection, number> = {
  items: 5000,
  orders: 2000,
  expenses: 2000,
  income: 1000,
  members: 2000,
};

export type Item = z.output<typeof itemInputSchema> & { id: string };
export type Order = z.output<typeof orderInputSchema> & { id: string };
export type Expense = z.output<typeof expenseInputSchema> & { id: string };
export type Income = z.output<typeof incomeInputSchema> & { id: string };
export type Member = z.output<typeof memberInputSchema> & { id: string };

export type AdminDoc = {
  updatedAt: string | null;
  items: Item[];
  orders: Order[];
  expenses: Expense[];
  income: Income[];
  members: Member[];
};

const row = z.object({ id: z.string() }).passthrough();
const storedSchema = z.object({
  updatedAt: z.string().nullable(),
  items: z.array(row).default([]),
  orders: z.array(row).default([]),
  expenses: z.array(row).default([]),
  income: z.array(row).default([]),
  members: z.array(row).default([]),
});

async function read(cfg: UpstashConfig): Promise<{ doc: AdminDoc; revision: number }> {
  // One script, so the document and its revision are read at the same instant
  // (two separate GETs could straddle someone else's save).
  const [reply] = await upstashPipeline(cfg, [["EVAL", READ_BOTH, 2, DOC_KEY, REV_KEY]]);
  const [rev, raw] = reply as [string, string];
  const revision = Number(rev);
  if (!raw) {
    return {
      doc: { updatedAt: null, items: [], orders: [], expenses: [], income: [], members: [] },
      revision,
    };
  }
  return { doc: storedSchema.parse(JSON.parse(raw)) as AdminDoc, revision };
}

export async function loadAdminDoc(cfg: UpstashConfig): Promise<AdminDoc> {
  return (await read(cfg)).doc;
}

/** Thrown from a change to refuse it with a message the user should see. */
export class AdminChangeError extends Error {}

/**
 * Applies `change` to the latest document and saves it atomically, retrying
 * on a concurrent save.
 */
export async function updateAdminDoc(
  cfg: UpstashConfig,
  change: (doc: AdminDoc) => AdminDoc,
): Promise<void> {
  for (let attempt = 0; attempt < 25; attempt++) {
    if (attempt > 0) {
      // Someone saved first: back off a random, growing amount so simultaneous
      // savers take turns instead of colliding again.
      await new Promise((r) => setTimeout(r, Math.random() * Math.min(400, 25 * 2 ** attempt)));
    }
    const { doc, revision } = await read(cfg);
    const next = { ...change(structuredClone(doc)), updatedAt: new Date().toISOString() };
    for (const name of COLLECTIONS) {
      if (next[name].length > COLLECTION_LIMITS[name]) {
        throw new AdminChangeError(
          `That would go over the limit of ${COLLECTION_LIMITS[name]} ${name}.`,
        );
      }
    }
    const [saved] = await upstashPipeline(cfg, [
      ["EVAL", COMPARE_AND_SET, 3, DOC_KEY, REV_KEY, HISTORY_KEY, revision, JSON.stringify(next)],
    ]);
    if (Number(saved) > 0) return;
  }
  throw new Error("admin store: too many concurrent saves");
}

export function newId(): string {
  return crypto.randomUUID();
}
