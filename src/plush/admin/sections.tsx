import type { AdminDoc, Expense, Income, Item, Member, Order } from "@/plush/admin.functions";
import {
  CONDITIONS,
  CURRENCIES,
  EXPENSE_CATEGORIES,
  FEE_METHODS,
  INCOME_STATUSES,
  INCOME_TYPES,
  ITEM_CATEGORIES,
  ITEM_SOURCE_LABELS,
  ITEM_SOURCES,
  MEMBER_ROLES,
  PAYMENT_METHODS,
  RECURRENCE,
} from "@/plush/admin-options";

import { itemSavings, memberOwing, memberStatus } from "./calc";
import { mixedMoney, money, round2, todayIso, totalsByCurrency } from "./format";
import { RecordTab, type Field, type FormValues } from "./RecordTab";

export type SectionProps = { doc: AdminDoc; canEdit: boolean; contactsHidden?: boolean };

const num = (v: unknown) => (typeof v === "number" ? v : 0);
const byDateDesc = (a: { date?: string | null }, b: { date?: string | null }) =>
  (b.date ?? "").localeCompare(a.date ?? "");
const small = (text: string | null | undefined) =>
  text ? <div className="text-xs text-muted-foreground">{text}</div> : null;

function Badge({
  tone,
  children,
}: {
  tone: "green" | "amber" | "red" | "gray" | "blue";
  children: string;
}) {
  const tones = {
    green: "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100",
    amber: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
    red: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100",
    gray: "bg-muted text-muted-foreground",
    blue: "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100",
  };
  return (
    <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** "Owed to payer" / "Reimbursed" when a person paid out of pocket. */
function reimburseBadge(r: {
  paidBy?: string | null;
  purchasedBy?: string | null;
  paymentMethod?: string | null;
  reimbursed: boolean;
}) {
  const payer = r.paidBy ?? r.purchasedBy;
  const outOfPocket =
    r.paymentMethod === "Personal card (reimburse)" || (!r.paymentMethod && Boolean(payer));
  if (!outOfPocket) return null;
  return r.reimbursed ? (
    <Badge tone="green">Reimbursed</Badge>
  ) : (
    <Badge tone="amber">Owed to payer</Badge>
  );
}

// ---- Items ---------------------------------------------------------------

const itemFields: Field[] = [
  {
    key: "item",
    label: "Item",
    kind: "text",
    required: true,
    wide: true,
    placeholder: "e.g. Kraken X60 motor",
  },
  { key: "category", label: "Category", kind: "select", options: ITEM_CATEGORIES, required: true },
  { key: "partNumber", label: "Part / SKU number", kind: "text", placeholder: "e.g. am-3740" },
  { key: "quantity", label: "Quantity", kind: "number", required: true },
  { key: "cost", label: "Price paid per unit (before tax)", kind: "money", required: true },
  {
    key: "total",
    label: "Line total (before tax)",
    kind: "money",
    hint: "Leave blank to use price × quantity.",
    computedFrom: (r) => round2(num(r.cost) * num(r.quantity)),
  },
  { key: "currency", label: "Currency", kind: "select", options: CURRENCIES, required: true },
  {
    key: "source",
    label: "Bought from",
    kind: "select",
    required: true,
    options: ITEM_SOURCES.map((s) => ({ value: s, label: ITEM_SOURCE_LABELS[s] })),
  },
  {
    key: "supplier",
    label: "Store / vendor",
    kind: "text",
    required: true,
    placeholder: "e.g. REV Robotics",
    showIf: (v) => v.source !== "team",
  },
  {
    key: "supplier",
    label: "Team (number and name)",
    kind: "text",
    required: true,
    placeholder: "e.g. FRC 8729 Sir Lancerbot",
    showIf: (v) => v.source === "team",
  },
  {
    key: "retailPrice",
    label: "Retail price per unit (new)",
    kind: "money",
    hint: "What it costs new, to show how much we saved.",
    showIf: (v) => v.source === "team",
  },
  { key: "condition", label: "Condition", kind: "select", options: CONDITIONS },
  { key: "date", label: "Date bought", kind: "date" },
  { key: "orderNumber", label: "Order / receipt #", kind: "text" },
  {
    key: "purchasedBy",
    label: "Paid out of pocket by",
    kind: "text",
    hint: "Only if a person paid and needs paying back.",
  },
  { key: "reimbursed", label: "Payer reimbursed", kind: "checkbox" },
  { key: "location", label: "Stored at", kind: "text", placeholder: "e.g. Electrical bin 3" },
  { key: "note", label: "Notes", kind: "textarea" },
];

export function ItemsTab({ doc, canEdit }: SectionProps) {
  return (
    <RecordTab<Item>
      collection="items"
      canEdit={canEdit}
      title="Inventory"
      noun="item"
      rows={doc.items}
      fields={itemFields}
      defaults={(): FormValues => ({
        category: "Other",
        currency: "CAD",
        source: "retail",
        quantity: "1",
        date: todayIso(),
        reimbursed: false,
      })}
      searchText={(i) =>
        [i.item, i.category, i.partNumber, i.supplier, i.orderNumber, i.location, i.note].join(" ")
      }
      sort={byDateDesc}
      filters={[
        {
          label: "Source",
          options: [
            { label: "All", test: () => true },
            { label: "Retail", test: (i) => i.source === "retail" },
            { label: "Another team", test: (i) => i.source === "team" },
          ],
        },
        {
          label: "Category",
          options: [
            { label: "All", test: () => true },
            ...ITEM_CATEGORIES.map((c) => ({ label: c, test: (i: Item) => i.category === c })),
          ],
        },
      ]}
      summary={(rows) => {
        const spent = totalsByCurrency(rows, (i) => i.total);
        const saved = totalsByCurrency(rows, itemSavings);
        return (
          <>
            {rows.length} items · {mixedMoney(spent)} before tax
            {(saved.CAD || saved.USD) > 0 && <> · saved {mixedMoney(saved)} buying from teams</>}
          </>
        );
      }}
      columns={[
        {
          label: "Item",
          render: (i) => (
            <>
              <div>{i.item}</div>
              {small(
                [i.category, i.partNumber, i.condition, i.location && `@ ${i.location}`]
                  .filter(Boolean)
                  .join(" · "),
              )}
              {small(i.note)}
            </>
          ),
        },
        { label: "Qty", align: "right", render: (i) => i.quantity },
        { label: "Paid / unit", align: "right", render: (i) => money(i.cost, i.currency) },
        { label: "Total", align: "right", render: (i) => money(i.total, i.currency) },
        {
          label: "From",
          render: (i) => (
            <>
              <div>{i.supplier}</div>
              <Badge tone={i.source === "team" ? "blue" : "gray"}>
                {ITEM_SOURCE_LABELS[i.source]}
              </Badge>
            </>
          ),
        },
        {
          label: "Retail / saved",
          align: "right",
          render: (i) =>
            i.source === "team" && i.retailPrice !== null ? (
              <>
                <div>{money(i.retailPrice, i.currency)}</div>
                <div className="text-xs text-green-700 dark:text-green-400">
                  saved {money(itemSavings(i), i.currency)}
                  {i.retailPrice > 0 && ` (${Math.round((1 - i.cost / i.retailPrice) * 100)}%)`}
                </div>
              </>
            ) : (
              "—"
            ),
        },
        {
          label: "Bought",
          render: (i) => (
            <>
              <div className="whitespace-nowrap">{i.date ?? "—"}</div>
              {small(i.orderNumber && `#${i.orderNumber}`)}
              {i.purchasedBy && small(`by ${i.purchasedBy}`)}
              {reimburseBadge(i)}
            </>
          ),
        },
      ]}
    />
  );
}

// ---- Orders --------------------------------------------------------------

const orderFields: Field[] = [
  { key: "supplier", label: "Store / vendor", kind: "text", required: true },
  { key: "orderNumber", label: "Order / receipt #", kind: "text" },
  { key: "date", label: "Order date", kind: "date" },
  { key: "currency", label: "Currency", kind: "select", options: CURRENCIES, required: true },
  { key: "subtotal", label: "Subtotal (items, before tax)", kind: "money", required: true },
  { key: "shipping", label: "Shipping", kind: "money" },
  { key: "tax", label: "Tax", kind: "money" },
  { key: "otherFees", label: "Other fees", kind: "money", hint: "Duties, FX fees, etc." },
  {
    key: "total",
    label: "Total charged",
    kind: "money",
    hint: "Leave blank to add up the lines above.",
    computedFrom: (r) => round2(num(r.subtotal) + num(r.shipping) + num(r.tax) + num(r.otherFees)),
  },
  { key: "paymentMethod", label: "Payment method", kind: "select", options: PAYMENT_METHODS },
  { key: "paidBy", label: "Paid by (person)", kind: "text" },
  { key: "reimbursed", label: "Payer reimbursed", kind: "checkbox" },
  { key: "notes", label: "Notes", kind: "textarea" },
];

export function OrdersTab({ doc, canEdit }: SectionProps) {
  return (
    <RecordTab<Order>
      collection="orders"
      canEdit={canEdit}
      title="Orders & receipts"
      noun="order"
      rows={doc.orders}
      fields={orderFields}
      defaults={() => ({ currency: "CAD", date: todayIso(), reimbursed: false })}
      searchText={(o) => [o.supplier, o.orderNumber, o.paidBy, o.notes].join(" ")}
      sort={byDateDesc}
      summary={(rows) => (
        <>
          {rows.length} orders · {mixedMoney(totalsByCurrency(rows, (o) => o.total))} charged
        </>
      )}
      columns={[
        {
          label: "Supplier",
          render: (o) => (
            <>
              <div>{o.supplier}</div>
              {small(o.orderNumber && `#${o.orderNumber}`)}
            </>
          ),
        },
        {
          label: "Date",
          render: (o) => <span className="whitespace-nowrap">{o.date ?? "—"}</span>,
        },
        { label: "Subtotal", align: "right", render: (o) => money(o.subtotal, o.currency) },
        { label: "Shipping", align: "right", render: (o) => money(o.shipping, o.currency) },
        { label: "Tax", align: "right", render: (o) => money(o.tax, o.currency) },
        { label: "Fees", align: "right", render: (o) => money(o.otherFees, o.currency) },
        {
          label: "Total",
          align: "right",
          render: (o) => <span className="font-medium">{money(o.total, o.currency)}</span>,
        },
        {
          label: "Paid with",
          render: (o) => (
            <>
              {small([o.paymentMethod, o.paidBy && `by ${o.paidBy}`].filter(Boolean).join(" · "))}
              {reimburseBadge(o)}
              {small(o.notes)}
            </>
          ),
        },
      ]}
    />
  );
}

// ---- Expenses ------------------------------------------------------------

const expenseFields: Field[] = [
  { key: "date", label: "Date", kind: "date" },
  {
    key: "category",
    label: "Category",
    kind: "select",
    options: EXPENSE_CATEGORIES,
    required: true,
  },
  {
    key: "description",
    label: "Description",
    kind: "text",
    required: true,
    wide: true,
    placeholder: "e.g. Ottawa District event registration",
  },
  {
    key: "payee",
    label: "Paid to",
    kind: "text",
    required: true,
    placeholder: "e.g. FIRST Robotics Canada",
  },
  { key: "amount", label: "Amount (before tax)", kind: "money", required: true },
  { key: "tax", label: "Tax", kind: "money" },
  {
    key: "total",
    label: "Total paid",
    kind: "money",
    hint: "Leave blank for amount + tax.",
    computedFrom: (r) => round2(num(r.amount) + num(r.tax)),
  },
  { key: "currency", label: "Currency", kind: "select", options: CURRENCIES, required: true },
  { key: "recurrence", label: "Repeats", kind: "select", options: RECURRENCE, required: true },
  { key: "paymentMethod", label: "Payment method", kind: "select", options: PAYMENT_METHODS },
  { key: "paidBy", label: "Paid by (person)", kind: "text" },
  { key: "reimbursed", label: "Payer reimbursed", kind: "checkbox" },
  { key: "reference", label: "Invoice / receipt #", kind: "text" },
  { key: "notes", label: "Notes", kind: "textarea" },
];

export function ExpensesTab({ doc, canEdit }: SectionProps) {
  return (
    <RecordTab<Expense>
      collection="expenses"
      canEdit={canEdit}
      title="Expenses"
      noun="expense"
      rows={doc.expenses}
      fields={expenseFields}
      defaults={() => ({
        currency: "CAD",
        date: todayIso(),
        recurrence: "One-time",
        category: "Competition & event fees",
        reimbursed: false,
      })}
      searchText={(e) =>
        [e.description, e.category, e.payee, e.reference, e.paidBy, e.notes].join(" ")
      }
      sort={byDateDesc}
      filters={[
        {
          label: "Category",
          options: [
            { label: "All", test: () => true },
            ...EXPENSE_CATEGORIES.map((c) => ({
              label: c,
              test: (e: Expense) => e.category === c,
            })),
          ],
        },
      ]}
      summary={(rows) => (
        <>
          {rows.length} expenses · {mixedMoney(totalsByCurrency(rows, (e) => e.total))}
        </>
      )}
      columns={[
        {
          label: "Expense",
          render: (e) => (
            <>
              <div>{e.description}</div>
              {small(
                [e.category, e.recurrence !== "One-time" && e.recurrence]
                  .filter(Boolean)
                  .join(" · "),
              )}
              {small(e.notes)}
            </>
          ),
        },
        {
          label: "Date",
          render: (e) => <span className="whitespace-nowrap">{e.date ?? "—"}</span>,
        },
        {
          label: "Paid to",
          render: (e) => (
            <>
              <div>{e.payee}</div>
              {small(e.reference && `#${e.reference}`)}
            </>
          ),
        },
        { label: "Amount", align: "right", render: (e) => money(e.amount, e.currency) },
        { label: "Tax", align: "right", render: (e) => money(e.tax, e.currency) },
        {
          label: "Total",
          align: "right",
          render: (e) => <span className="font-medium">{money(e.total, e.currency)}</span>,
        },
        {
          label: "Paid with",
          render: (e) => (
            <>
              {small([e.paymentMethod, e.paidBy && `by ${e.paidBy}`].filter(Boolean).join(" · "))}
              {reimburseBadge(e)}
            </>
          ),
        },
      ]}
    />
  );
}

// ---- Income --------------------------------------------------------------

const incomeTone = {
  Applied: "gray",
  Pledged: "amber",
  Received: "green",
  Declined: "red",
} as const;

const incomeFields: Field[] = [
  { key: "type", label: "Type", kind: "select", options: INCOME_TYPES, required: true },
  {
    key: "source",
    label: "From (organization / person)",
    kind: "text",
    required: true,
    placeholder: "e.g. FIRST Robotics Canada",
  },
  {
    key: "program",
    label: "Grant program / sponsor tier",
    kind: "text",
    placeholder: "e.g. Rookie grant, Gold sponsor",
  },
  { key: "status", label: "Status", kind: "select", options: INCOME_STATUSES, required: true },
  { key: "amount", label: "Amount", kind: "money", required: true },
  { key: "currency", label: "Currency", kind: "select", options: CURRENCIES, required: true },
  { key: "dateApplied", label: "Date applied / asked", kind: "date" },
  { key: "dateReceived", label: "Date received", kind: "date" },
  {
    key: "reportDue",
    label: "Report / follow-up due",
    kind: "date",
    hint: "Grant report or thank-you deadline.",
  },
  { key: "contactName", label: "Contact name", kind: "text" },
  { key: "contactEmail", label: "Contact email", kind: "email" },
  { key: "reference", label: "Agreement / cheque #", kind: "text" },
  {
    key: "restrictions",
    label: "What it can be spent on",
    kind: "textarea",
    placeholder: "Leave blank if unrestricted",
  },
  {
    key: "recognition",
    label: "What we promised in return",
    kind: "textarea",
    placeholder: "e.g. logo on robot and shirts, 2 social posts",
  },
  { key: "notes", label: "Notes", kind: "textarea" },
];

export function IncomeTab({ doc, canEdit }: SectionProps) {
  return (
    <RecordTab<Income>
      collection="income"
      canEdit={canEdit}
      title="Grants & sponsorships"
      noun="entry"
      rows={doc.income}
      fields={incomeFields}
      defaults={() => ({ type: "Sponsorship", status: "Pledged", currency: "CAD" })}
      searchText={(r) => [r.source, r.program, r.type, r.status, r.contactName, r.notes].join(" ")}
      sort={(a, b) =>
        (b.dateReceived ?? b.dateApplied ?? "").localeCompare(a.dateReceived ?? a.dateApplied ?? "")
      }
      filters={[
        {
          label: "Type",
          options: [
            { label: "All", test: () => true },
            ...INCOME_TYPES.map((t) => ({ label: t, test: (r: Income) => r.type === t })),
          ],
        },
        {
          label: "Status",
          options: [
            { label: "All", test: () => true },
            ...INCOME_STATUSES.map((s) => ({ label: s, test: (r: Income) => r.status === s })),
          ],
        },
      ]}
      summary={(rows) => (
        <>
          {mixedMoney(
            totalsByCurrency(
              rows,
              (r) => r.amount,
              (r) => r.status === "Received",
            ),
          )}{" "}
          received
          {" · "}
          {mixedMoney(
            totalsByCurrency(
              rows,
              (r) => r.amount,
              (r) => r.status === "Pledged",
            ),
          )}{" "}
          pledged
        </>
      )}
      columns={[
        {
          label: "From",
          render: (r) => (
            <>
              <div>{r.source}</div>
              {small([r.type, r.program].filter(Boolean).join(" · "))}
              {small([r.contactName, r.contactEmail].filter(Boolean).join(" · "))}
            </>
          ),
        },
        { label: "Status", render: (r) => <Badge tone={incomeTone[r.status]}>{r.status}</Badge> },
        {
          label: "Amount",
          align: "right",
          render: (r) => <span className="font-medium">{money(r.amount, r.currency)}</span>,
        },
        {
          label: "Dates",
          render: (r) => (
            <div className="whitespace-nowrap text-xs">
              {r.dateApplied && <div>Applied {r.dateApplied}</div>}
              {r.dateReceived && <div>Received {r.dateReceived}</div>}
              {r.reportDue && (
                <div className={r.reportDue < todayIso() ? "text-destructive" : ""}>
                  Report due {r.reportDue}
                </div>
              )}
            </div>
          ),
        },
        {
          label: "Conditions",
          render: (r) => (
            <>
              {r.restrictions && small(`Spend on: ${r.restrictions}`)}
              {r.recognition && small(`We owe: ${r.recognition}`)}
              {small(r.notes)}
            </>
          ),
        },
      ]}
    />
  );
}

// ---- Members -------------------------------------------------------------

const memberTone = { Waived: "gray", Paid: "green", Partial: "amber", Unpaid: "red" } as const;

const memberFields: Field[] = [
  { key: "name", label: "Name", kind: "text", required: true },
  { key: "role", label: "Role", kind: "select", options: MEMBER_ROLES, required: true },
  { key: "season", label: "Season", kind: "text", required: true, placeholder: "e.g. 2026–27" },
  { key: "amountDue", label: "Fee due (CAD)", kind: "money", required: true },
  { key: "amountPaid", label: "Amount paid (CAD)", kind: "money" },
  { key: "paidDate", label: "Date paid", kind: "date" },
  { key: "method", label: "Paid by", kind: "select", options: FEE_METHODS },
  { key: "receivedBy", label: "Collected by", kind: "text" },
  { key: "waived", label: "Fee waived", kind: "checkbox" },
  {
    key: "contactEmail",
    label: "Contact email",
    kind: "email",
    hint: "Parent/guardian for students.",
  },
  { key: "notes", label: "Notes", kind: "textarea" },
];

export function MembersTab({ doc, canEdit, contactsHidden }: SectionProps) {
  const seasons = [...new Set(doc.members.map((m) => m.season))].sort().reverse();
  const latestSeason = seasons[0] ?? "";
  return (
    <RecordTab<Member>
      collection="members"
      canEdit={canEdit}
      title="Membership fees"
      noun="member"
      rows={doc.members}
      fields={memberFields}
      defaults={() => ({
        role: "Student",
        season: latestSeason,
        amountDue: String(doc.members.find((m) => m.season === latestSeason)?.amountDue ?? ""),
        amountPaid: "0",
        waived: false,
      })}
      searchText={(m) => [m.name, m.role, m.season, m.receivedBy, m.notes].join(" ")}
      sort={(a, b) => b.season.localeCompare(a.season) || a.name.localeCompare(b.name)}
      filters={[
        {
          label: "Status",
          options: [
            { label: "All", test: () => true },
            { label: "Still owes", test: (m) => memberOwing(m) > 0 },
            ...(["Paid", "Partial", "Unpaid", "Waived"] as const).map((s) => ({
              label: s,
              test: (m: Member) => memberStatus(m) === s,
            })),
          ],
        },
        {
          label: "Season",
          options: [
            { label: "All", test: () => true },
            ...seasons.map((s) => ({ label: s, test: (m: Member) => m.season === s })),
          ],
        },
      ]}
      summary={(rows) => {
        const owing = rows.filter((m) => memberOwing(m) > 0);
        const paid = rows.filter((m) => memberStatus(m) === "Paid").length;
        return (
          <>
            {paid} of {rows.length} paid · {money(rows.reduce((t, m) => t + m.amountPaid, 0))}{" "}
            collected
            {owing.length > 0 && (
              <>
                {" "}
                · {owing.length} still owe {money(owing.reduce((t, m) => t + memberOwing(m), 0))}
              </>
            )}
          </>
        );
      }}
      columns={[
        {
          label: "Name",
          render: (m) => (
            <>
              <div>{m.name}</div>
              {small(
                [m.role, contactsHidden ? "contact hidden for viewers" : m.contactEmail]
                  .filter(Boolean)
                  .join(" · "),
              )}
            </>
          ),
        },
        { label: "Season", render: (m) => m.season },
        {
          label: "Status",
          render: (m) => <Badge tone={memberTone[memberStatus(m)]}>{memberStatus(m)}</Badge>,
        },
        { label: "Due", align: "right", render: (m) => money(m.amountDue) },
        { label: "Paid", align: "right", render: (m) => money(m.amountPaid) },
        {
          label: "Owing",
          align: "right",
          render: (m) =>
            memberOwing(m) > 0 ? (
              <span className="font-medium text-destructive">{money(memberOwing(m))}</span>
            ) : (
              "—"
            ),
        },
        {
          label: "Payment",
          render: (m) => (
            <>
              {small(
                [m.paidDate, m.method, m.receivedBy && `to ${m.receivedBy}`]
                  .filter(Boolean)
                  .join(" · "),
              )}
              {small(m.notes)}
            </>
          ),
        },
      ]}
    />
  );
}
