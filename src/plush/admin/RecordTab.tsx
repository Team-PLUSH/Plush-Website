import { useRouter } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import { mutateAdminData, type Collection, type MutationInput } from "@/plush/admin.functions";

// One admin section: a searchable, filterable table with add / edit / delete.
// Each section (items, orders, ...) describes its form fields and columns, and
// this component does the rest.

type Option = string | { value: string; label: string };

export type Field = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "number" | "money" | "date" | "select" | "checkbox" | "email";
  options?: readonly Option[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** Only shown when this returns true for the values typed so far. */
  showIf?: (values: FormValues) => boolean;
  /** For a total that is worked out when left blank: how to work it out. */
  computedFrom?: (row: Record<string, unknown>) => number;
  wide?: boolean;
};

export type Column<T> = {
  label: string;
  render: (row: T) => ReactNode;
  align?: "right";
};

export type Filter<T> = {
  label: string;
  options: { label: string; test: (row: T) => boolean }[];
};

export type FormValues = Record<string, string | boolean>;

type Props<T extends { id: string }> = {
  collection: Collection;
  title: string;
  noun: string;
  rows: T[];
  fields: Field[];
  columns: Column<T>[];
  defaults: () => FormValues;
  searchText: (row: T) => string;
  filters?: Filter<T>[];
  summary?: (rows: T[]) => ReactNode;
  sort?: (a: T, b: T) => number;
};

const optionValue = (o: Option) => (typeof o === "string" ? o : o.value);
const optionLabel = (o: Option) => (typeof o === "string" ? o : o.label);

function toFormValues(row: Record<string, unknown>, fields: Field[]): FormValues {
  const values: FormValues = {};
  for (const f of fields) {
    const v = row[f.key];
    if (f.kind === "checkbox") values[f.key] = v === true;
    else if (f.computedFrom && typeof v === "number" && Math.abs(v - f.computedFrom(row)) < 0.005)
      values[f.key] = ""; // matches the worked-out value: leave blank so it stays in sync
    else values[f.key] = v === null || v === undefined ? "" : String(v);
  }
  return values;
}

function toPayload(values: FormValues, fields: Field[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.showIf && !f.showIf(values)) {
      // A hidden field clears its value, unless a visible field shares its key.
      if (!(f.key in out)) out[f.key] = f.kind === "checkbox" ? false : null;
      continue;
    }
    const v = values[f.key];
    if (f.kind === "checkbox") out[f.key] = v === true;
    else if (f.kind === "number" || f.kind === "money") {
      const s = String(v ?? "").replace(/[$,\s]/g, "");
      out[f.key] = s === "" ? null : Number(s);
    } else out[f.key] = String(v ?? "");
  }
  return out;
}

export function RecordTab<T extends { id: string }>(props: Props<T>) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filterChoice, setFilterChoice] = useState<number[]>(() =>
    (props.filters ?? []).map(() => 0),
  );
  const [editing, setEditing] = useState<{ id: string | null; values: FormValues } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = props.rows.filter((row) => {
      if (q && !props.searchText(row).toLowerCase().includes(q)) return false;
      return (props.filters ?? []).every((f, i) => f.options[filterChoice[i]]?.test(row) ?? true);
    });
    return props.sort ? [...rows].sort(props.sort) : rows;
  }, [props, query, filterChoice]);

  async function run(payload: MutationInput) {
    setBusy(true);
    setError(null);
    try {
      const result = await mutateAdminData({ data: payload });
      if (result.ok) {
        setEditing(null);
        setConfirmDelete(null);
        await router.invalidate();
        return;
      }
      if (result.reason === "signed-out") {
        await router.invalidate();
        return;
      }
      setError(
        result.message ??
          (result.reason === "storage-error"
            ? "Couldn't reach the database. Try again."
            : "That didn't save."),
      );
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    void run({
      op: "save",
      collection: props.collection,
      id: editing.id,
      value: toPayload(editing.values, props.fields),
    });
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="pa-title text-xl">{props.title}</h2>
          {props.summary && (
            <div className="text-sm text-muted-foreground">{props.summary(visible)}</div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setEditing({ id: null, values: props.defaults() });
          }}
          className="pa-btn text-sm"
        >
          + Add {props.noun}
        </button>
      </div>

      {editing && (
        <form
          onSubmit={onSubmit}
          className="pa-card is-purple mt-4 p-4"
          aria-label={editing.id ? `Edit ${props.noun}` : `Add ${props.noun}`}
        >
          <h3 className="pa-title">{editing.id ? `Edit ${props.noun}` : `New ${props.noun}`}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {props.fields
              .filter((f) => !f.showIf || f.showIf(editing.values))
              .map((f) => (
                <FieldInput
                  key={f.key}
                  field={f}
                  value={editing.values[f.key]}
                  onChange={(v) =>
                    setEditing((e) => (e ? { ...e, values: { ...e.values, [f.key]: v } } : e))
                  }
                />
              ))}
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={busy} className="pa-btn text-sm">
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="pa-btn is-light text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search"
          aria-label={`Search ${props.title}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-56 px-3 py-1.5 text-sm"
        />
        {(props.filters ?? []).map((f, i) => (
          <select
            key={f.label}
            aria-label={f.label}
            value={filterChoice[i]}
            onChange={(e) =>
              setFilterChoice((c) => c.map((v, j) => (j === i ? Number(e.target.value) : v)))
            }
            className="px-2 py-1.5 text-sm"
          >
            {f.options.map((o, j) => (
              <option key={o.label} value={j}>
                {f.label}: {o.label}
              </option>
            ))}
          </select>
        ))}
        <span className="text-xs text-muted-foreground">
          {visible.length} of {props.rows.length}
        </span>
      </div>

      {!editing && error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="pa-card pa-table mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr>
              {props.columns.map((c) => (
                <th
                  key={c.label}
                  className={`whitespace-nowrap px-3 py-2 font-medium ${c.align === "right" ? "text-right" : ""}`}
                >
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                {props.columns.map((c) => (
                  <td
                    key={c.label}
                    className={`px-3 py-2 ${c.align === "right" ? "text-right tabular-nums" : ""}`}
                  >
                    {c.render(row)}
                  </td>
                ))}
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setEditing({
                        id: row.id,
                        values: toFormValues(row as Record<string, unknown>, props.fields),
                      });
                    }}
                    className="rounded px-2 py-1 text-xs hover:bg-accent"
                  >
                    Edit
                  </button>
                  {confirmDelete === row.id ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run({ op: "delete", collection: props.collection, id: row.id })
                      }
                      className="pa-btn is-danger px-2 py-0.5 text-xs"
                    >
                      Confirm delete
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(row.id)}
                      className="rounded px-2 py-1 text-xs text-destructive hover:bg-accent"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={props.columns.length + 1}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  {props.rows.length === 0
                    ? `No ${props.title.toLowerCase()} yet.`
                    : "Nothing matches."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}) {
  const id = `field-${field.key}`;
  const base = "mt-1 w-full px-3 py-2 text-sm";
  const label = (
    <label htmlFor={id} className="block text-sm font-medium">
      {field.label}
      {field.required && <span className="text-destructive"> *</span>}
    </label>
  );
  const hint = field.hint && <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p>;

  if (field.kind === "checkbox") {
    return (
      <div className="flex items-start gap-2 pt-6">
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5"
        />
        <div>
          {label}
          {hint}
        </div>
      </div>
    );
  }

  const wide = field.wide || field.kind === "textarea" ? "sm:col-span-2 lg:col-span-3" : "";
  const str = typeof value === "string" ? value : "";

  return (
    <div className={wide}>
      {label}
      {field.kind === "select" ? (
        <select
          id={id}
          required={field.required}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        >
          {!field.required && <option value="">—</option>}
          {(field.options ?? []).map((o) => (
            <option key={optionValue(o)} value={optionValue(o)}>
              {optionLabel(o)}
            </option>
          ))}
        </select>
      ) : field.kind === "textarea" ? (
        <textarea
          id={id}
          rows={2}
          value={str}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      ) : (
        <input
          id={id}
          type={field.kind === "date" || field.kind === "email" ? field.kind : "text"}
          inputMode={field.kind === "money" || field.kind === "number" ? "decimal" : undefined}
          required={field.required}
          value={str}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      )}
      {hint}
    </div>
  );
}
