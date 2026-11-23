import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";

import {
  adminLogin,
  adminLogout,
  getInventory,
  type Inventory,
  type LoginResult,
} from "@/plush/inventory.functions";

// Private team page. The password check and the data both live server-side
// (see src/plush/inventory.functions.ts); this file only renders what a
// signed-in session is sent. Kept out of search engines with noindex.

export const Route = createFileRoute("/admin/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory · Team PLUSH" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  loader: () => getInventory(),
  staleTime: 0,
  component: InventoryPage,
});

function InventoryPage() {
  const result = Route.useLoaderData();

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-6xl">
        {result.status === "ok" && <InventoryView inventory={result.inventory} />}
        {result.status === "signed-out" && <LoginForm />}
        {result.status === "not-configured" && (
          <Notice title="Not set up yet">
            Set <code>ADMIN_PASSWORD</code> (12+ characters) and <code>ADMIN_SESSION_SECRET</code>{" "}
            (32+ characters) in the Vercel project&apos;s environment variables, then redeploy.
          </Notice>
        )}
        {result.status === "data-error" && (
          <Notice title="Inventory data missing">
            <code>INVENTORY_JSON</code> is empty or invalid in the Vercel environment variables. The
            function logs say what is wrong with it.
          </Notice>
        )}
      </div>
    </main>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-border p-6 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

const LOGIN_MESSAGES: Record<Exclude<LoginResult, { ok: true }>["reason"], string> = {
  wrong: "That password isn't right.",
  limited: "Too many attempts. Try again in 15 minutes.",
  "not-configured": "The admin password hasn't been set up yet.",
};

function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await adminLogin({ data: { password } });
      if (result.ok) {
        setPassword("");
        await router.invalidate();
      } else {
        setError(LOGIN_MESSAGES[result.reason]);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm rounded-lg border border-border p-6">
      <h1 className="text-xl font-semibold">Team PLUSH · Inventory</h1>
      <p className="mt-1 text-sm text-muted-foreground">Team members only.</p>
      <label htmlFor="admin-password" className="mt-5 block text-sm font-medium">
        Password
      </label>
      <input
        id="admin-password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || password === ""}
        className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}

const formatters = {
  CAD: new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }),
  USD: new Intl.NumberFormat("en-CA", { style: "currency", currency: "USD" }),
};

function fmt(value: number | null, currency: "CAD" | "USD"): string {
  return value === null ? "—" : formatters[currency].format(value);
}

function sumBy<T>(
  rows: T[],
  currency: "CAD" | "USD",
  pick: (row: T) => number,
  cur: (row: T) => string,
) {
  return rows.filter((r) => cur(r) === currency).reduce((total, r) => total + pick(r), 0);
}

function InventoryView({ inventory }: { inventory: Inventory }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return inventory.items;
    return inventory.items.filter((i) =>
      `${i.item} ${i.supplier} ${i.note ?? ""}`.toLowerCase().includes(q),
    );
  }, [inventory.items, query]);

  const paidCad = sumBy(
    inventory.orders,
    "CAD",
    (o) => o.total,
    (o) => o.currency,
  );
  const paidUsd = sumBy(
    inventory.orders,
    "USD",
    (o) => o.total,
    (o) => o.currency,
  );

  async function signOut() {
    await adminLogout();
    await router.invalidate();
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Team PLUSH · Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {inventory.items.length} items · {inventory.orders.length} orders · updated{" "}
            {inventory.updated}
          </p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
        >
          Sign out
        </button>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <Stat label="Total paid (CAD)" value={fmt(paidCad, "CAD")} />
        <Stat label="Total paid (USD)" value={fmt(paidUsd, "USD")} />
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Items</h2>
          <input
            type="search"
            placeholder="Search items or suppliers"
            aria-label="Search items or suppliers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-64 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Cost bf Tax</th>
                <th className="px-3 py-2 text-right font-medium">Quantity</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Supplier</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, index) => (
                <tr key={`${i.supplier}-${i.item}-${index}`} className="border-t border-border">
                  <td className="px-3 py-2">
                    {i.item}
                    {i.note && <div className="text-xs text-muted-foreground">{i.note}</div>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(i.cost, i.currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{i.quantity}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(i.total, i.currency)}</td>
                  <td className="px-3 py-2">{i.supplier}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    No items match “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Orders</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Supplier</th>
                <th className="px-3 py-2 font-medium">Order #</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                <th className="px-3 py-2 text-right font-medium">Shipping</th>
                <th className="px-3 py-2 text-right font-medium">Tax</th>
                <th className="px-3 py-2 text-right font-medium">Fees</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {inventory.orders.map((o, index) => (
                <tr
                  key={`${o.supplier}-${o.orderNumber ?? index}`}
                  className="border-t border-border"
                >
                  <td className="px-3 py-2">{o.supplier}</td>
                  <td className="px-3 py-2">{o.orderNumber ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{o.date ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmt(o.subtotal, o.currency)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmt(o.shipping, o.currency)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(o.tax, o.currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmt(o.otherFees, o.currency)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {fmt(o.total, o.currency)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{o.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
