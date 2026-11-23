// Turns a vendor's order export (CSV) or an invoice / packing slip (PDF text)
// into draft inventory rows for the review table in OrderImport.tsx.
//
// Pure functions only — no DOM, no network. Everything runs in the browser and
// nothing is sent anywhere until a person has reviewed the rows and pressed
// "Add", which goes through the normal validated import (admin.functions.ts).

import { ITEM_CATEGORIES } from "@/plush/admin-options";

export type MappedField = "item" | "partNumber" | "quantity" | "cost" | "total";

export const MAPPED_FIELDS: { key: MappedField; label: string }[] = [
  { key: "item", label: "Item" },
  { key: "partNumber", label: "Part #" },
  { key: "quantity", label: "Qty" },
  { key: "cost", label: "Unit cost" },
  { key: "total", label: "Line total" },
];

export type Category = (typeof ITEM_CATEGORIES)[number];

export type DraftRow = {
  key: string;
  include: boolean;
  item: string;
  partNumber: string;
  category: Category;
  quantity: string;
  cost: string;
  total: string;
  /** Fields filled by a guess rather than read from the file; shown highlighted. */
  guessed: Partial<Record<MappedField, true>>;
};

export type OrderMeta = {
  supplier: string | null;
  orderNumber: string | null;
  date: string | null;
  /** True when the date was ambiguous (e.g. 03/04/2026) and we picked month-first. */
  dateGuessed: boolean;
  currency: "CAD" | "USD" | null;
  subtotal: number | null;
  shipping: number | null;
  tax: number | null;
  total: number | null;
};

export type Table = { headers: string[]; rows: string[][] };
/** Which field each column feeds, by column index (null = ignore the column). */
export type Mapping = (MappedField | null)[];

const round2 = (n: number) => Math.round(n * 100) / 100;

let keySeq = 0;
const nextKey = () => `r${++keySeq}`;

// ---- Numbers ---------------------------------------------------------------

/** "$1,234.50", "CA$12.00", "12,50" → number; blanks, negatives and junk → null. */
export function parseMoney(raw: string | undefined): number | null {
  if (!raw) return null;
  let t = raw
    .trim()
    .replace(/\b(CAD|USD)\b/gi, "")
    .replace(/(CA|US|C|U)?\$/gi, "")
    .replace(/\s/g, "");
  if (t === "" || t.startsWith("-") || /^\(.*\)$/.test(t)) return null;
  if (/^\d+,\d{2}$/.test(t)) t = t.replace(",", ".");
  t = t.replace(/,(?=\d{3}(\D|$))/g, "");
  if (!/^\d*\.?\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n <= 1_000_000 ? round2(n) : null;
}

/** "2", "2 ea", "10.0" → number > 0; anything else → null. */
export function parseQty(raw: string | undefined): number | null {
  const m = raw?.trim().match(/^(\d{1,6}(?:\.\d+)?)(?:\s*(?:ea|each|pcs?|units?|x))?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 && n <= 100_000 ? n : null;
}

// ---- CSV -------------------------------------------------------------------

/** RFC 4180-ish CSV: quoted fields, doubled quotes, CRLF, and , ; or tab delimiters. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const sample = src.slice(0, 4000);
  const count = (d: string) => sample.split(d).length;
  const delimiter = [",", ";", "\t"].reduce((a, b) => (count(b) > count(a) ? b : a));

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (ch === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}

// ---- Header recognition ----------------------------------------------------

const SYNONYMS: Record<MappedField, string[]> = {
  item: [
    "description",
    "item",
    "itemdescription",
    "itemname",
    "product",
    "productname",
    "productdescription",
    "partdescription",
    "name",
    "title",
  ],
  partNumber: [
    "manufacturerpartnumber",
    "mfrpartnumber",
    "mpn",
    "partnumber",
    "partno",
    "partnum",
    "part",
    "sku",
    "itemnumber",
    "itemno",
    "productcode",
    "productnumber",
    "catalognumber",
    "model",
  ],
  quantity: [
    "qty",
    "quantity",
    "qtyordered",
    "quantityordered",
    "qtyshipped",
    "quantityshipped",
    "ordered",
    "shipped",
    "units",
  ],
  cost: [
    "unitprice",
    "priceeach",
    "unitcost",
    "price",
    "each",
    "priceper",
    "rate",
    "yourprice",
    "netprice",
  ],
  total: [
    "extendedprice",
    "extprice",
    "extended",
    "linetotal",
    "totalprice",
    "amount",
    "total",
    "itemtotal",
    "subtotal",
  ],
};

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/#/g, "number")
    .replace(/[^a-z0-9]+/g, "");
}

function headerScore(header: string, field: MappedField): number {
  const h = normalizeHeader(header);
  if (h === "") return 0;
  let best = 0;
  for (const syn of SYNONYMS[field]) {
    if (h === syn) best = Math.max(best, 3);
    else if (syn.length >= 3 && (h.startsWith(syn) || h.endsWith(syn))) best = Math.max(best, 2);
    else if (syn.length >= 5 && h.includes(syn)) best = Math.max(best, 1);
  }
  // A manufacturer part number beats a distributor's own stock number.
  if (field === "partNumber" && /manufacturer|mfr|mpn/.test(h)) best += 0.5;
  return best;
}

/** Best guess at which field each header names; each field used at most once. */
export function mapHeaders(headers: string[]): Mapping {
  const candidates: { col: number; field: MappedField; score: number }[] = [];
  headers.forEach((header, col) => {
    for (const { key } of MAPPED_FIELDS) {
      const score = headerScore(header, key);
      if (score > 0) candidates.push({ col, field: key, score });
    }
  });
  candidates.sort((a, b) => b.score - a.score || a.col - b.col);
  const mapping: Mapping = headers.map(() => null);
  const used = new Set<MappedField>();
  for (const c of candidates) {
    if (mapping[c.col] !== null || used.has(c.field)) continue;
    mapping[c.col] = c.field;
    used.add(c.field);
  }
  return mapping;
}

function looksLikeHeader(mapping: Mapping): boolean {
  const has = (f: MappedField) => mapping.includes(f);
  return has("item") && (has("quantity") || has("cost") || has("total"));
}

/** Index of the first row that reads like a column header, or -1. */
export function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    if (looksLikeHeader(mapHeaders(rows[i]))) return i;
  }
  return -1;
}

// ---- Categories and part numbers -------------------------------------------

const CATEGORY_HINTS: [Category, RegExp][] = [
  [
    "Motors & motor controllers",
    /\b(motor|neo|falcon|kraken|vortex|cim|spark ?max|talon|victor|servo|gearmotor)\b/i,
  ],
  ["Pneumatics", /\b(pneumatic|solenoid|cylinder|compressor|air tank|pcm|ph\b|push.?to.?connect)/i],
  [
    "Control system",
    /\b(roborio|radio|pdh|pdp|power distribution|limelight|navx|pigeon|canivore|encoder|gyro|camera|driver station)\b/i,
  ],
  [
    "Electrical",
    /\b(wire|wiring|cable|connector|anderson|wago|ferrule|breaker|fuse|battery|terminal|crimp|heat ?shrink|awg)\b/i,
  ],
  [
    "Fasteners & hardware",
    /\b(bolt|screw|nut|washer|rivet|standoff|spacer|shoulder|nylock|zip ?tie|cotter|retaining ring|shcs|bhcs)\b/i,
  ],
  [
    "Raw stock (tube, plate, shaft)",
    /\b(tube|tubing|plate|sheet|shaft|hex stock|bar stock|angle|channel|extrusion|polycarb|lexan)\b/i,
  ],
  [
    "Mechanical",
    /\b(bearing|gear|sprocket|pulley|belt|chain|wheel|hub|bushing|collar|gearbox|swerve|hinge|spring|bumper)\b/i,
  ],
  [
    "Tools",
    /\b(drill|wrench|driver|plier|saw|file|hammer|clamp|tap|bit|caliper|allen|hex key|multimeter|solder)\b/i,
  ],
  ["Safety", /\b(safety|glasses|goggles|gloves|first aid|ear)\b/i],
  ["Shop supplies", /\b(tape|glue|epoxy|loctite|lubricant|grease|paint|marker|rag|sandpaper)\b/i],
];

export function guessCategory(text: string): Category {
  for (const [category, re] of CATEGORY_HINTS) if (re.test(text)) return category;
  return "Other";
}

/** A leading vendor part number in a description: "REV-41-1600 NEO…", "am-0255 …". */
function partNumberFrom(description: string): { part: string; rest: string } | null {
  const m = description.match(/^\s*([A-Za-z]{0,6}-?\d[\w.]*(?:-[\w.]+)+)\s+[-–:]?\s*(.+)$/);
  return m ? { part: m[1], rest: m[2] } : null;
}

// ---- Draft rows ------------------------------------------------------------

type Raw = {
  item: string;
  partNumber: string;
  quantity: number | null;
  cost: number | null;
  total: number | null;
};

function makeDraft(raw: Raw, extraGuesses: Partial<Record<MappedField, true>> = {}): DraftRow {
  const guessed: Partial<Record<MappedField, true>> = { ...extraGuesses };
  let { item, partNumber, quantity, cost } = raw;
  const { total } = raw;

  if (!partNumber) {
    const split = partNumberFrom(item);
    if (split) {
      partNumber = split.part;
      item = split.rest;
      guessed.partNumber = true;
    }
  }
  if (quantity === null) {
    const ratio = cost && total !== null ? total / cost : null;
    quantity = ratio && Math.abs(ratio - Math.round(ratio)) < 0.01 ? Math.round(ratio) : 1;
    guessed.quantity = true;
  }
  if (cost === null && total !== null) {
    cost = round2(total / quantity);
    guessed.cost = true;
  }

  return {
    key: nextKey(),
    include: item.trim() !== "",
    item: item.trim(),
    partNumber: partNumber.trim(),
    category: guessCategory(`${item} ${partNumber}`),
    quantity: String(quantity),
    cost: cost === null ? "" : cost.toFixed(2),
    total: total === null ? "" : total.toFixed(2),
    guessed,
  };
}

/** A blank row for the "+ Add a row" button. */
export function emptyDraft(): DraftRow {
  return {
    key: nextKey(),
    include: true,
    item: "",
    partNumber: "",
    category: "Other",
    quantity: "1",
    cost: "",
    total: "",
    guessed: {},
  };
}

const SUMMARY_LINE =
  /^\s*(sub\s*-?\s*total|total|grand\s*total|order\s*total|shipping|freight|delivery|handling|discount|tax|hst|gst|pst|qst|vat|balance|amount\s*due|payment)\b/i;

/** Draft rows from a table whose columns have been mapped. */
export function rowsFromTable(table: Table, mapping: Mapping): DraftRow[] {
  const col = (f: MappedField) => mapping.indexOf(f);
  const drafts: DraftRow[] = [];
  for (const row of table.rows) {
    const get = (f: MappedField) => (col(f) >= 0 ? (row[col(f)] ?? "").trim() : "");
    const mapped = MAPPED_FIELDS.map(({ key }) => get(key));
    if (mapped.every((v) => v === "")) continue;
    const quantity = parseQty(get("quantity"));
    if (SUMMARY_LINE.test(get("item")) && quantity === null) continue;
    if (!get("item") && quantity === null && parseMoney(get("cost")) === null) continue;
    drafts.push(
      makeDraft({
        item: get("item"),
        partNumber: get("partNumber"),
        quantity,
        cost: parseMoney(get("cost")),
        total: parseMoney(get("total")),
      }),
    );
  }
  return drafts;
}

// ---- Order details (supplier, order #, date, totals) -----------------------

const SUPPLIERS: [string, RegExp][] = [
  ["REV Robotics", /rev\s*robotics|revrobotics\./i],
  ["AndyMark", /andymark/i],
  ["West Coast Products", /west\s*coast\s*products|wcproducts\./i],
  ["The Thrifty Bot", /thrifty\s*bot/i],
  ["CTR Electronics", /ctr[\s-]*electronics/i],
  ["Studica", /studica/i],
  ["VEX Robotics", /vex\s*robotics|vexrobotics\./i],
  ["Swyft Robotics", /swyft/i],
  ["Redux Robotics", /redux\s*robotics/i],
  ["Playing With Fusion", /playing\s*with\s*fusion/i],
  ["DigiKey", /digi-?key/i],
  ["Mouser", /mouser/i],
  ["McMaster-Carr", /mcmaster/i],
  ["RobotShop", /robotshop/i],
  ["SparkFun", /sparkfun/i],
  ["Adafruit", /adafruit/i],
  ["Amazon", /amazon\.(ca|com)|\bamazon\b/i],
  ["Home Depot", /home\s*depot/i],
  ["Canadian Tire", /canadian\s*tire/i],
  ["Princess Auto", /princess\s*auto/i],
  ["Lee Valley", /lee\s*valley/i],
  ["Grainger", /grainger/i],
];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = String.raw`(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?`;

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || y < 2000 || y > 2100) return null;
  return date.toISOString().slice(0, 10);
}

/** The first date in `text`, as YYYY-MM-DD. */
export function findDate(text: string): { date: string; guessed: boolean } | null {
  const patterns: [RegExp, (m: RegExpMatchArray) => { date: string | null; guessed: boolean }][] = [
    [
      /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/,
      (m) => ({ date: iso(+m[1], +m[2], +m[3]), guessed: false }),
    ],
    [
      new RegExp(String.raw`\b${MONTH_RE}\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b`, "i"),
      (m) => ({
        date: iso(+m[3], MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, +m[2]),
        guessed: false,
      }),
    ],
    [
      new RegExp(String.raw`\b(\d{1,2})\s+${MONTH_RE},?\s+(\d{4})\b`, "i"),
      (m) => ({
        date: iso(+m[3], MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, +m[1]),
        guessed: false,
      }),
    ],
    [
      /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4}|\d{2})\b/,
      (m) => {
        const a = +m[1];
        const b = +m[2];
        if (a > 12) return { date: iso(+m[3], b, a), guessed: false }; // day-first
        if (b > 12) return { date: iso(+m[3], a, b), guessed: false }; // month-first
        return { date: iso(+m[3], a, b), guessed: a !== b }; // ambiguous: month-first
      },
    ],
  ];
  let best: { index: number; date: string; guessed: boolean } | null = null;
  for (const [re, read] of patterns) {
    const m = text.match(re);
    if (!m || m.index === undefined) continue;
    const { date, guessed } = read(m);
    if (date && (!best || m.index < best.index)) best = { index: m.index, date, guessed };
  }
  return best && { date: best.date, guessed: best.guessed };
}

const MONEY_IN_LINE = /(?:(?:CA|US|C)?\$\s?)?(\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})/g;

function lastMoney(line: string): number | null {
  const all = [...line.matchAll(MONEY_IN_LINE)];
  return all.length ? parseMoney(all[all.length - 1][0]) : null;
}

/** Supplier, order number, date, currency and totals found anywhere in `text`. */
export function extractMeta(text: string): OrderMeta {
  const meta: OrderMeta = {
    supplier: SUPPLIERS.find(([, re]) => re.test(text))?.[0] ?? null,
    orderNumber: null,
    date: null,
    dateGuessed: false,
    currency: /\bCAD\b|C\$|CA\$/.test(text) ? "CAD" : /\bUSD\b|US\$/.test(text) ? "USD" : null,
    subtotal: null,
    shipping: null,
    tax: null,
    total: null,
  };

  for (const m of text.matchAll(
    /\b(?:order|invoice|sales\s*order|purchase\s*order|p\.?o\.?|receipt|confirmation)\s*(?:number|no\.?|num|#|id)?\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{3,30})\b/gi,
  )) {
    if (/\d/.test(m[1])) {
      meta.orderNumber = m[1];
      break;
    }
  }

  // Prefer a date that sits next to a "date" label; else the first date at all.
  const labelled = text.match(/\b(?:order|invoice|ship|purchase|sale)?\s*date\b[^\n]{0,40}/i);
  const found = (labelled && findDate(labelled[0])) || findDate(text);
  if (found) {
    meta.date = found.date;
    meta.dateGuessed = found.guessed;
  }

  let tax = 0;
  let sawTax = false;
  for (const rawLine of text.split("\n")) {
    // CSV summary rows start with empty cells: ",,,,Subtotal,4821.10".
    const line = rawLine.replace(/^[\s,;\t"]+/, "");
    const amount = lastMoney(line);
    if (amount === null) continue;
    if (/^\s*sub\s*-?\s*total\b/i.test(line)) meta.subtotal = amount;
    else if (/\b(shipping|freight|delivery)\b/i.test(line)) meta.shipping = amount;
    else if (/\b(tax|hst|gst|pst|qst|vat)\b/i.test(line)) {
      tax += amount;
      sawTax = true;
    } else if (/^\s*(order\s*|grand\s*|invoice\s*)?total\b/i.test(line)) meta.total = amount;
  }
  if (sawTax) meta.tax = round2(tax);
  return meta;
}

const PART_PREFIXES: [string, RegExp][] = [
  ["REV Robotics", /^REV-\d/i],
  ["AndyMark", /^am-\d/i],
  ["West Coast Products", /^WCP-\d/i],
  ["The Thrifty Bot", /^TTB-/i],
  ["DigiKey", /-ND$/i],
];

/**
 * The vendor whose part-number style fills a whole column, when the file never
 * names it — e.g. DigiKey exports carry a "…-ND" column next to the MPN.
 */
export function supplierFromParts(table: Table | null, rows: DraftRow[]): string | null {
  const columns: string[][] = [rows.map((r) => r.partNumber)];
  if (table) table.headers.forEach((_, i) => columns.push(table.rows.map((r) => r[i] ?? "")));
  for (const column of columns) {
    const values = column.map((v) => v.trim()).filter(Boolean);
    if (values.length === 0) continue;
    for (const [name, re] of PART_PREFIXES) {
      if (values.filter((v) => re.test(v)).length / values.length >= 0.5) return name;
    }
  }
  return null;
}

// ---- PDF text --------------------------------------------------------------

/** One positioned run of text from pdf.js (`x`/`y` in PDF units, y grows upward). */
export type PdfTextItem = { str: string; x: number; y: number; w: number; h: number; page: number };
export type PdfCell = { text: string; x0: number; x1: number };
export type PdfLine = { page: number; y: number; h: number; cells: PdfCell[] };

/** Groups pdf.js text runs into visual lines, and each line into column cells. */
export function groupPdfLines(items: PdfTextItem[]): PdfLine[] {
  const runs = items
    .filter((i) => i.str.trim() !== "")
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const lines: { page: number; y: number; h: number; runs: PdfTextItem[] }[] = [];
  for (const run of runs) {
    const h = run.h || 10;
    const line = lines.find(
      (l) => l.page === run.page && Math.abs(l.y - run.y) <= Math.max(2, h * 0.5),
    );
    if (line) line.runs.push(run);
    else lines.push({ page: run.page, y: run.y, h, runs: [run] });
  }
  return lines
    .sort((a, b) => a.page - b.page || b.y - a.y)
    .map((line) => {
      const sorted = line.runs.sort((a, b) => a.x - b.x);
      const cells: PdfCell[] = [];
      for (const run of sorted) {
        const last = cells[cells.length - 1];
        const gap = last ? run.x - last.x1 : Infinity;
        if (last && gap < Math.max(4, line.h * 0.9)) {
          last.text += (gap > line.h * 0.12 ? " " : "") + run.str.trim();
          last.x1 = Math.max(last.x1, run.x + run.w);
        } else {
          cells.push({ text: run.str.trim(), x0: run.x, x1: run.x + run.w });
        }
      }
      return { page: line.page, y: line.y, h: line.h, cells };
    });
}

export const pdfLineText = (line: PdfLine) => line.cells.map((c) => c.text).join("  ");

/**
 * Rebuilds the line-item table from positioned PDF text: finds the header row
 * ("Qty", "Description", "Unit Price"...), then drops each later cell into the
 * column it sits under. Wrapped descriptions are joined onto the row above.
 */
export function tableFromPdf(lines: PdfLine[]): { table: Table; mapping: Mapping } | null {
  const headerIndex = lines.findIndex((l) =>
    looksLikeHeader(mapHeaders(l.cells.map((c) => c.text))),
  );
  if (headerIndex < 0) return null;
  const header = lines[headerIndex];
  const headers = header.cells.map((c) => c.text);
  const mapping = mapHeaders(headers);
  const itemCol = mapping.indexOf("item");
  const numberCols = new Set(
    (["quantity", "cost", "total"] as MappedField[])
      .map((f) => mapping.indexOf(f))
      .filter((i) => i >= 0),
  );

  const columnFor = (cell: PdfCell): number => {
    let best = -1;
    let bestOverlap = 0;
    header.cells.forEach((h, i) => {
      const overlap = Math.min(cell.x1, h.x1) - Math.max(cell.x0, h.x0);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = i;
      }
    });
    if (best >= 0) return best;
    const mid = (cell.x0 + cell.x1) / 2;
    let nearest = -1;
    let distance = 80;
    header.cells.forEach((h, i) => {
      const d = Math.abs((h.x0 + h.x1) / 2 - mid);
      if (d < distance) {
        distance = d;
        nearest = i;
      }
    });
    return nearest;
  };

  const rows: string[][] = [];
  let previous: PdfLine | null = null;
  for (const line of lines.slice(headerIndex + 1)) {
    const text = pdfLineText(line);
    if (looksLikeHeader(mapHeaders(line.cells.map((c) => c.text)))) continue; // repeated on a new page
    if (/^\s*page\s+\d/i.test(text)) continue;
    if (SUMMARY_LINE.test(line.cells[0]?.text ?? "") || SUMMARY_LINE.test(text)) break;

    const cells: string[] = headers.map(() => "");
    for (const cell of line.cells) {
      const col = columnFor(cell);
      if (col >= 0) cells[col] = cells[col] ? `${cells[col]} ${cell.text}` : cell.text;
    }
    const hasNumbers = [...numberCols].some(
      (i) => parseQty(cells[i]) !== null || parseMoney(cells[i]) !== null,
    );
    if (hasNumbers) {
      rows.push(cells);
      previous = line;
      continue;
    }
    // A wrapped description: only text, under the item column, right below a row.
    const onlyItem = cells.every((c, i) => c === "" || i === itemCol);
    const close =
      previous &&
      previous.page === line.page &&
      previous.y - line.y < Math.max(previous.h, line.h) * 2.6;
    if (rows.length && itemCol >= 0 && onlyItem && close && cells[itemCol]) {
      const last = rows[rows.length - 1];
      last[itemCol] = `${last[itemCol]} ${cells[itemCol]}`.trim();
      previous = line;
    }
  }
  return { table: { headers, rows }, mapping };
}

const MONEY = String.raw`(?:(?:CA|US|C)?\$\s?)?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}`;
const QTY_FIRST = new RegExp(
  String.raw`^(\d{1,5})\s*(?:x\s+|ea\.?\s+)?(.+?)\s+(${MONEY})(?:\s+(${MONEY}))?\s*$`,
  "i",
);
const QTY_AFTER = new RegExp(
  String.raw`^(.+?)\s+(\d{1,5})\s*(?:ea\.?|pcs?)?\s+(${MONEY})(?:\s+(${MONEY}))?\s*$`,
  "i",
);

/**
 * Fallback when a PDF has no recognisable header row: reads lines shaped like
 * "2  NEO Brushless Motor  $42.00  $84.00". Everything is marked as a guess.
 */
export function rowsFromLooseLines(lines: string[]): DraftRow[] {
  const drafts: DraftRow[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (SUMMARY_LINE.test(line) || /\b(invoice|order\s*(number|date|#)|page \d)\b/i.test(line))
      continue;
    const a = line.match(QTY_FIRST);
    const b = a ? null : line.match(QTY_AFTER);
    const m = a ?? b;
    if (!m) continue;
    const [quantity, item] = a ? [Number(a[1]), a[2]] : [Number(m[2]), m[1]];
    const first = parseMoney(m[3]);
    const second = parseMoney(m[4]);
    // With one amount we can't tell unit price from line total: assume unit.
    const cost = first;
    const total = second ?? null;
    drafts.push(
      makeDraft(
        { item, partNumber: "", quantity, cost, total },
        { item: true, quantity: true, ...(second === null ? { cost: true as const } : {}) },
      ),
    );
  }
  return drafts;
}
