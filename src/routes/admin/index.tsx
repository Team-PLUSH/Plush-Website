import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { adminLogout, getAdminData, type AdminDoc } from "@/plush/admin.functions";
import { ImportPanel, LoginForm, Overview } from "@/plush/admin/Panels";
import { ExpensesTab, IncomeTab, ItemsTab, MembersTab, OrdersTab } from "@/plush/admin/sections";

// Private team admin: inventory, orders, expenses, grants & sponsorships, and
// membership fees. The sign-in check and all data live server-side (see
// src/plush/admin.functions.ts); this page only renders what a signed-in
// session is sent. Kept out of search engines with noindex.

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin · Team PLUSH" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
    links: [
      // Self-hosted brand fonts + the admin's Scribble Jam styles (same look as
      // the homepage). All first-party, so the CSP needs nothing new.
      { rel: "stylesheet", href: "/fonts.css" },
      { rel: "stylesheet", href: "/plush-admin.css" },
    ],
  }),
  loader: () => getAdminData(),
  staleTime: 0,
  component: AdminPage,
});

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "items", label: "Inventory" },
  { id: "orders", label: "Orders" },
  { id: "expenses", label: "Expenses" },
  { id: "income", label: "Grants & sponsors" },
  { id: "members", label: "Member fees" },
  { id: "import", label: "Import / backup" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function AdminPage() {
  const result = Route.useLoaderData();

  return (
    <main className="plush-admin min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl">
        {result.status !== "ok" && (
          <div className="flex justify-end">
            <ThemeToggle />
          </div>
        )}
        {result.status === "ok" && <Dashboard doc={result.doc} />}
        {result.status === "signed-out" && <LoginForm />}
        {result.status === "not-configured" && (
          <Notice title="Not set up yet">
            {result.missing.includes("password") && (
              <>
                Set <code>ADMIN_PASSWORD</code> (12+ characters) and{" "}
                <code>ADMIN_SESSION_SECRET</code> (32+ characters) in the Vercel project&apos;s
                environment variables.{" "}
              </>
            )}
            {result.missing.includes("database") && (
              <>Connect the Upstash Redis store to this Vercel project. </>
            )}
            Then redeploy.
          </Notice>
        )}
        {result.status === "storage-error" && (
          <Notice title="Couldn't reach the database">
            Upstash didn&apos;t answer. Refresh in a minute; the function logs have details.
          </Notice>
        )}
      </div>
    </main>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pa-card mx-auto mt-16 max-w-md p-6 text-center">
      <h1 className="pa-title text-xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function Dashboard({ doc }: { doc: AdminDoc }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");

  const [confirmAll, setConfirmAll] = useState(false);

  async function signOut(everywhere = false) {
    await adminLogout({ data: { everywhere } });
    await router.invalidate();
  }

  const counts: Partial<Record<TabId, number>> = {
    items: doc.items.length,
    orders: doc.orders.length,
    expenses: doc.expenses.length,
    income: doc.income.length,
    members: doc.members.length,
  };

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="pa-title text-3xl">
            Team PLUSH <span className="text-muted-foreground">·</span> Admin
          </h1>
          <p className="pa-hand text-muted-foreground">
            parts <span className="pa-star">✦</span> money <span className="pa-star">✦</span>{" "}
            members
          </p>
          <p className="text-xs text-muted-foreground">
            {doc.updatedAt
              ? `Last change ${new Date(doc.updatedAt).toLocaleString("en-CA")}`
              : "Nothing saved yet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => (confirmAll ? signOut(true) : setConfirmAll(true))}
            onBlur={() => setConfirmAll(false)}
            className="pa-btn is-light text-sm"
            title="Ends every signed-in session, on every device"
          >
            {confirmAll ? "Sure? Sign out all" : "Sign out everywhere"}
          </button>
          <button type="button" onClick={() => signOut()} className="pa-btn is-light text-sm">
            Sign out
          </button>
        </div>
      </header>

      <nav role="tablist" aria-label="Admin sections" className="pa-tabs mt-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className="pa-tab"
          >
            {t.label}
            {counts[t.id] !== undefined && <span className="pa-count">{counts[t.id]}</span>}
          </button>
        ))}
      </nav>

      <div className="mt-6" role="tabpanel">
        {tab === "overview" && <Overview doc={doc} />}
        {tab === "items" && <ItemsTab doc={doc} />}
        {tab === "orders" && <OrdersTab doc={doc} />}
        {tab === "expenses" && <ExpensesTab doc={doc} />}
        {tab === "income" && <IncomeTab doc={doc} />}
        {tab === "members" && <MembersTab doc={doc} />}
        {tab === "import" && <ImportPanel doc={doc} />}
      </div>
    </>
  );
}

// Same saved setting as the homepage's moon/sun button (src/plush/core/theme.ts).
const THEME_KEY = "plush-theme";

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    let saved = false;
    try {
      saved = localStorage.getItem(THEME_KEY) === "dark";
    } catch {
      // Storage blocked (private mode etc.): just stay light.
    }
    document.documentElement.classList.toggle("dark", saved);
    setDark(saved);
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      // Not saved; the switch still works for this visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="pa-theme"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
