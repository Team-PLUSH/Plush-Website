import { useRouter } from "@tanstack/react-router";
import { useState, type ChangeEvent, type ReactNode } from "react";

import { mutateAdminData } from "@/plush/admin.functions";
import {
  CURRENCIES,
  ITEM_CATEGORIES,
  ITEM_SOURCES,
  ITEM_SOURCE_LABELS,
} from "@/plush/admin-options";

import { money, round2, todayIso, type Currency } from "./format";
import {
  emptyDraft,
  extractMeta,
  findHeaderRow,
  mapHeaders,
  MAPPED_FIELDS,
  parseCsv,
  parseMoney,
  parseQty,
  pdfLineText,
  rowsFromLooseLines,
  rowsFromTable,
  supplierFromParts,
  tableFromPdf,
  type Category,
  type DraftRow,
  type MappedField,
  type Mapping,
  type OrderMeta,
  type Table,
} from "./intake/parse";

// "Import an order" on the Inventory tab: pick a vendor's CSV export or a PDF
// invoice / packing slip, check the rows it found, fix anything it got wrong,
// then add them all at once. Files are read in the browser — nothing is
// uploaded — and the rows are saved through the normal validated import, so
// they show up in the activity log like any other change.

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 500;

type Shared = {
  supplier: string;
  date: string;
  dateGuessed: boolean;
  orderNumber: string;
  currency: Currency;
  source: (typeof ITEM_SOURCES)[number];
  purchasedBy: string;
  location: string;
};

type OrderDraft = { add: boolean; subtotal: string; shipping: string; tax: string; total: string };

type Review = {
  fileName: string;
  /** Present when the file had a header row; its columns can be re-mapped. */
  table: Table | null;
  mapping: Mapping;
  rows: DraftRow[];
  shared: Shared;
  order: OrderDraft;
  note: string | null;
};

const fmt = (n: number | null) => (n === null ? "" : n.toFixed(2));

function buildReview(
  fileName: string,
  parsed: { table: Table; mapping: Mapping } | null,
  rows: DraftRow[],
  meta: OrderMeta,
  note: string | null,
): Review {
  return {
    fileName,
    table: parsed?.table ?? null,
    mapping: parsed?.mapping ?? [],
    rows: rows.slice(0, MAX_ROWS),
    shared: {
      supplier: meta.supplier ?? supplierFromParts(parsed?.table ?? null, rows) ?? "",
      date: meta.date ?? todayIso(),
      dateGuessed: meta.dateGuessed || meta.date === null,
      orderNumber: meta.orderNumber ?? "",
      currency: meta.currency ?? "CAD",
      source: "retail",
      purchasedBy: "",
      location: "",
    },
    order: {
      add: true,
      subtotal: fmt(meta.subtotal),
      shipping: fmt(meta.shipping),
      tax: fmt(meta.tax),
      total: fmt(meta.total),
    },
    note: rows.length > MAX_ROWS ? `Only the first ${MAX_ROWS} rows are shown.` : note,
  };
}

async function readFile(file: File): Promise<Review> {
  if (file.size > MAX_FILE_BYTES) throw new Error("That file is over 10 MB.");
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);

  if (isPdf) {
    const { readPdfLines } = await import("./intake/pdf");
    const lines = await readPdfLines(file);
    if (lines.length === 0) {
      throw new Error(
        "This PDF has no text to read — it's probably a scan or photo. Use the vendor's emailed or downloaded invoice instead.",
      );
    }
    const text = lines.map(pdfLineText).join("\n");
    const parsed = tableFromPdf(lines);
    const rows = parsed
      ? rowsFromTable(parsed.table, parsed.mapping)
      : rowsFromLooseLines(lines.map(pdfLineText));
    return buildReview(
      file.name,
      parsed,
      rows,
      extractMeta(text),
      parsed ? null : "No column headings found, so these rows are a best guess — check each one.",
    );
  }

  const text = await file.text();
  const grid = parseCsv(text);
  const headerRow = findHeaderRow(grid);
  if (headerRow < 0 && grid.length === 0) throw new Error("That file is empty.");
  const start = Math.max(headerRow, 0);
  const width = Math.max(...grid.slice(start).map((r) => r.length));
  const table: Table = {
    headers:
      headerRow >= 0 ? grid[headerRow] : Array.from({ length: width }, (_, i) => `Column ${i + 1}`),
    rows: grid.slice(headerRow >= 0 ? headerRow + 1 : 0),
  };
  const mapping = headerRow >= 0 ? mapHeaders(table.headers) : table.headers.map(() => null);
  return buildReview(
    file.name,
    { table, mapping },
    rowsFromTable(table, mapping),
    extractMeta(text),
    headerRow >= 0 ? null : "No column headings found — pick what each column holds below.",
  );
}

type RowProblem = Partial<Record<"item" | "quantity" | "cost", true>>;

function rowProblems(row: DraftRow): RowProblem {
  const p: RowProblem = {};
  if (row.item.trim() === "") p.item = true;
  if (parseQty(row.quantity) === null) p.quantity = true;
  if (parseMoney(row.cost) === null && row.cost.trim() !== "0") p.cost = true;
  return p;
}

/** Line total that doesn't match qty × unit cost (a sign a column was misread). */
function totalMismatch(row: DraftRow): boolean {
  const q = parseQty(row.quantity);
  const c = parseMoney(row.cost);
  const t = parseMoney(row.total);
  return q !== null && c !== null && t !== null && Math.abs(round2(q * c) - t) > 0.02;
}

export function OrderImport() {
  const router = useRouter();
  const [review, setReview] = useState<Review | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(null);
    setReading(file.name);
    try {
      const next = await readFile(file);
      if (next.rows.length === 0 && !next.table) {
        setMessage({ ok: false, text: "No line items found in that file." });
      } else {
        setReview(next);
      }
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error && error.message ? error.message : "Couldn't read that file.",
      });
    } finally {
      setReading(null);
    }
  }

  if (!review) {
    return (
      <section className="pa-card p-4" aria-label="Import an order">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="pa-title text-lg">Import an order</h2>
            <p className="text-sm text-muted-foreground">
              Pick a vendor's CSV export or a PDF invoice / packing slip. You'll check every row
              before anything is saved. Files stay on this device.
            </p>
          </div>
          <label className="pa-btn cursor-pointer text-sm">
            {reading ? `Reading ${reading}…` : "Choose CSV or PDF"}
            <input
              type="file"
              accept=".csv,.tsv,.txt,.pdf,text/csv,application/pdf"
              className="sr-only"
              disabled={reading !== null}
              onChange={onFile}
            />
          </label>
        </div>
        {message && <Notice ok={message.ok}>{message.text}</Notice>}
      </section>
    );
  }

  return (
    <ReviewPanel
      review={review}
      setReview={setReview}
      busy={busy}
      message={message}
      onCancel={() => {
        setReview(null);
        setMessage(null);
      }}
      onSubmit={async (payload, count) => {
        setBusy(true);
        setMessage(null);
        try {
          const result = await mutateAdminData({
            data: { op: "import", mode: "append", json: JSON.stringify(payload) },
          });
          if (result.ok) {
            setReview(null);
            setMessage({ ok: true, text: `Added ${count}.` });
            await router.invalidate();
          } else if (result.reason === "signed-out") {
            await router.invalidate();
          } else {
            setMessage({ ok: false, text: result.message ?? "Couldn't save. Nothing was added." });
          }
        } catch {
          setMessage({ ok: false, text: "Something went wrong. Nothing was added — try again." });
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

function ReviewPanel({
  review,
  setReview,
  busy,
  message,
  onCancel,
  onSubmit,
}: {
  review: Review;
  setReview: (r: Review) => void;
  busy: boolean;
  message: { ok: boolean; text: string } | null;
  onCancel: () => void;
  onSubmit: (payload: object, count: string) => Promise<void>;
}) {
  const { rows, shared, order } = review;
  const included = rows.filter((r) => r.include);
  const broken = included.filter((r) => Object.keys(rowProblems(r)).length > 0).length;
  const lineSum = round2(
    included.reduce((sum, r) => {
      const t = parseMoney(r.total);
      const q = parseQty(r.quantity) ?? 0;
      const c = parseMoney(r.cost) ?? 0;
      return sum + (t ?? q * c);
    }, 0),
  );
  const missingSupplier = shared.supplier.trim() === "";
  const canSave = included.length > 0 && broken === 0 && !missingSupplier && !busy;

  const setShared = (patch: Partial<Shared>) =>
    setReview({ ...review, shared: { ...shared, ...patch } });
  const setOrder = (patch: Partial<OrderDraft>) =>
    setReview({ ...review, order: { ...order, ...patch } });
  const setRow = (key: string, patch: Partial<DraftRow>) =>
    setReview({
      ...review,
      rows: rows.map((r) => {
        if (r.key !== key) return r;
        // Once someone edits a field, it's no longer a guess.
        const guessed = { ...r.guessed };
        for (const k of Object.keys(patch)) delete guessed[k as MappedField];
        return { ...r, ...patch, guessed };
      }),
    });
  const remap = (col: number, field: MappedField | null) => {
    if (!review.table) return;
    const mapping = review.mapping.map((f, i) => (i === col ? field : f === field ? null : f));
    setReview({
      ...review,
      mapping,
      rows: rowsFromTable(review.table, mapping).slice(0, MAX_ROWS),
    });
  };

  function submit() {
    const str = (v: string) => v.trim() || null;
    const items = included.map((r) => ({
      item: r.item.trim(),
      category: r.category,
      partNumber: str(r.partNumber),
      quantity: parseQty(r.quantity),
      cost: parseMoney(r.cost) ?? 0,
      total: parseMoney(r.total),
      currency: shared.currency,
      source: shared.source,
      supplier: shared.supplier.trim(),
      date: str(shared.date),
      orderNumber: str(shared.orderNumber),
      purchasedBy: str(shared.purchasedBy),
      location: str(shared.location),
    }));
    const orders = order.add
      ? [
          {
            supplier: shared.supplier.trim(),
            orderNumber: str(shared.orderNumber),
            date: str(shared.date),
            currency: shared.currency,
            subtotal: parseMoney(order.subtotal) ?? lineSum,
            shipping: parseMoney(order.shipping),
            tax: parseMoney(order.tax),
            total: parseMoney(order.total),
            paidBy: str(shared.purchasedBy),
          },
        ]
      : [];
    const count =
      `${items.length} item${items.length === 1 ? "" : "s"}` +
      (orders.length ? " and 1 order" : "");
    void onSubmit({ items, orders }, count);
  }

  const mapped = new Set(review.mapping.filter(Boolean));
  const needsMapping =
    review.table && !(mapped.has("item") && (mapped.has("cost") || mapped.has("total")));

  return (
    <section className="pa-card space-y-4 p-4" aria-label={`Review ${review.fileName}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="pa-title text-lg">Check the rows from {review.fileName}</h2>
          <p className="text-sm text-muted-foreground">
            <span className="pa-guess-key">Highlighted</span> fields were guessed;{" "}
            <span className="pa-bad-key">outlined</span> ones need fixing. Untick anything that
            isn't a part.
          </p>
        </div>
        <button
          type="button"
          className="pa-btn is-light text-sm"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
      {review.note && <Notice ok={false}>{review.note}</Notice>}

      {review.table && (
        <details open={Boolean(needsMapping)} className="text-sm">
          <summary className="cursor-pointer font-semibold">Columns in the file</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {review.table.headers.map((header, col) => (
              <label key={col} className="block">
                <span className="block truncate text-xs text-muted-foreground" title={header}>
                  {header || `Column ${col + 1}`}
                </span>
                <select
                  value={review.mapping[col] ?? ""}
                  onChange={(e) => remap(col, (e.target.value || null) as MappedField | null)}
                  className="mt-1 w-full px-2 py-1 text-sm"
                >
                  <option value="">— ignore —</option>
                  {MAPPED_FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Changing a column re-reads the rows, so do this before editing them.
          </p>
        </details>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SharedField label="Supplier" required bad={missingSupplier}>
          <input
            value={shared.supplier}
            onChange={(e) => setShared({ supplier: e.target.value })}
            placeholder="e.g. REV Robotics"
            className={`mt-1 w-full px-3 py-2 text-sm ${missingSupplier ? "pa-bad" : ""}`}
          />
        </SharedField>
        <SharedField label="Date">
          <input
            type="date"
            value={shared.date}
            onChange={(e) => setShared({ date: e.target.value, dateGuessed: false })}
            className={`mt-1 w-full px-3 py-2 text-sm ${shared.dateGuessed ? "pa-guess" : ""}`}
          />
        </SharedField>
        <SharedField label="Order #">
          <input
            value={shared.orderNumber}
            onChange={(e) => setShared({ orderNumber: e.target.value })}
            className="mt-1 w-full px-3 py-2 text-sm"
          />
        </SharedField>
        <SharedField label="Currency">
          <select
            value={shared.currency}
            onChange={(e) => setShared({ currency: e.target.value as Currency })}
            className="mt-1 w-full px-3 py-2 text-sm"
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </SharedField>
        <SharedField label="Bought from">
          <select
            value={shared.source}
            onChange={(e) => setShared({ source: e.target.value as Shared["source"] })}
            className="mt-1 w-full px-3 py-2 text-sm"
          >
            {ITEM_SOURCES.map((s) => (
              <option key={s} value={s}>
                {ITEM_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </SharedField>
        <SharedField label="Paid out of pocket by">
          <input
            value={shared.purchasedBy}
            onChange={(e) => setShared({ purchasedBy: e.target.value })}
            placeholder="Only if someone needs paying back"
            className="mt-1 w-full px-3 py-2 text-sm"
          />
        </SharedField>
        <SharedField label="Stored at">
          <input
            value={shared.location}
            onChange={(e) => setShared({ location: e.target.value })}
            placeholder="e.g. Electrical bin 3"
            className="mt-1 w-full px-3 py-2 text-sm"
          />
        </SharedField>
      </div>

      <div className="pa-table overflow-x-auto rounded-xl border-2 border-[var(--input)]">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr>
              <th className="px-2 py-2">
                <span className="sr-only">Include</span>
              </th>
              <th className="px-2 py-2">Item</th>
              <th className="px-2 py-2">Part #</th>
              <th className="px-2 py-2">Category</th>
              <th className="px-2 py-2">Qty</th>
              <th className="px-2 py-2">Unit cost</th>
              <th className="px-2 py-2">Line total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const bad = row.include ? rowProblems(row) : {};
              const cls = (f: MappedField) =>
                `w-full px-2 py-1 text-sm ${bad[f as keyof RowProblem] ? "pa-bad" : row.guessed[f] ? "pa-guess" : ""}`;
              const label = `row ${index + 1}`;
              return (
                <tr key={row.key} className={row.include ? "" : "opacity-50"}>
                  <td className="px-2 py-1 align-top">
                    <input
                      type="checkbox"
                      aria-label={`Include ${label}`}
                      checked={row.include}
                      onChange={(e) => setRow(row.key, { include: e.target.checked })}
                      className="mt-2"
                    />
                  </td>
                  <td className="min-w-[14rem] px-2 py-1">
                    <input
                      aria-label={`Item, ${label}`}
                      value={row.item}
                      onChange={(e) => setRow(row.key, { item: e.target.value })}
                      className={cls("item")}
                    />
                  </td>
                  <td className="min-w-[8rem] px-2 py-1">
                    <input
                      aria-label={`Part number, ${label}`}
                      value={row.partNumber}
                      onChange={(e) => setRow(row.key, { partNumber: e.target.value })}
                      className={cls("partNumber")}
                    />
                  </td>
                  <td className="min-w-[10rem] px-2 py-1">
                    <select
                      aria-label={`Category, ${label}`}
                      value={row.category}
                      onChange={(e) => setRow(row.key, { category: e.target.value as Category })}
                      className="w-full px-2 py-1 text-sm"
                    >
                      {ITEM_CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  <td className="w-20 px-2 py-1">
                    <input
                      aria-label={`Quantity, ${label}`}
                      inputMode="decimal"
                      value={row.quantity}
                      onChange={(e) => setRow(row.key, { quantity: e.target.value })}
                      className={cls("quantity")}
                    />
                  </td>
                  <td className="w-28 px-2 py-1">
                    <input
                      aria-label={`Unit cost, ${label}`}
                      inputMode="decimal"
                      value={row.cost}
                      onChange={(e) => setRow(row.key, { cost: e.target.value })}
                      className={cls("cost")}
                    />
                  </td>
                  <td className="w-28 px-2 py-1">
                    <input
                      aria-label={`Line total, ${label}`}
                      inputMode="decimal"
                      value={row.total}
                      onChange={(e) => setRow(row.key, { total: e.target.value })}
                      placeholder="qty × cost"
                      title={totalMismatch(row) ? "Doesn't equal qty × unit cost" : undefined}
                      className={`${cls("total")} ${totalMismatch(row) ? "pa-guess" : ""}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="pa-btn is-light text-sm"
        onClick={() => setReview({ ...review, rows: [...rows, emptyDraft()] })}
      >
        + Add a row
      </button>

      <fieldset className="rounded-xl border-2 border-dashed border-[var(--input)] p-3">
        <legend className="px-1 text-sm font-semibold">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={order.add}
              onChange={(e) => setOrder({ add: e.target.checked })}
            />
            Also add this order to the Orders tab
          </label>
        </legend>
        {order.add && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["subtotal", "Subtotal", money(lineSum, shared.currency)],
                ["shipping", "Shipping", ""],
                ["tax", "Tax", ""],
                ["total", "Total", "sum of the above"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <SharedField key={key} label={label}>
                <input
                  inputMode="decimal"
                  value={order[key]}
                  placeholder={placeholder}
                  onChange={(e) => setOrder({ [key]: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm"
                />
              </SharedField>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="pa-btn text-sm" disabled={!canSave} onClick={submit}>
          {busy
            ? "Adding…"
            : `Add ${included.length} item${included.length === 1 ? "" : "s"}${order.add ? " + order" : ""}`}
        </button>
        <span className="text-sm text-muted-foreground" role="status">
          {missingSupplier
            ? "Enter the supplier first."
            : broken > 0
              ? `${broken} row${broken === 1 ? "" : "s"} need fixing (or untick them).`
              : `Items total ${money(lineSum, shared.currency)} before tax.`}
        </span>
      </div>
      {message && <Notice ok={message.ok}>{message.text}</Notice>}
    </section>
  );
}

function SharedField({
  label,
  required,
  bad,
  children,
}: {
  label: string;
  required?: boolean;
  bad?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {required && <span className={bad ? "text-destructive" : ""}> *</span>}
      {children}
    </label>
  );
}

function Notice({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <p role={ok ? "status" : "alert"} className={`mt-3 text-sm ${ok ? "" : "text-destructive"}`}>
      {children}
    </p>
  );
}
