import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
  adminLogout,
  getAdminData,
  getUsdCadRates,
  type AdminDoc,
  type AdminResult,
  type FxRate,
} from "@/plush/admin.functions";
import { AccountsPanel, ActivityPanel, ChangePasswordForm } from "@/plush/admin/AccountPanels";
import { ImportPanel, LoginForm, Overview } from "@/plush/admin/Panels";
import { todayIso } from "@/plush/admin/format";
import { earliestUsdDate, hasUsd, rateOn, toCad } from "@/plush/admin/fx";
import { ExpensesTab, IncomeTab, ItemsTab, MembersTab, OrdersTab } from "@/plush/admin/sections";

// Private team admin: inventory, orders, expenses, grants & sponsorships, and
// membership fees, with a personal account per person. Sign-in, roles and all
// data live server-side (see src/plush/admin.functions.ts); this page only
// renders what the signed-in person is allowed to see. Kept out of search
// engines with noindex.

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
  { id: "activity", label: "Activity" },
  { id: "import", label: "Import / backup" },
  { id: "accounts", label: "Accounts" },
] as const;

const ROLE_NAME = { owner: "Owner", editor: "Editor", viewer: "Viewer" } as const;
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
        {result.status === "ok" && <Dashboard data={result} />}
        {result.status === "signed-out" && <LoginForm />}
        {result.status === "change-password" && <ChangePasswordForm me={result.me} forced />}
        {result.status === "not-configured" && (
          <Notice title="Not set up yet">
            {result.missing.includes("password") && (
              <>
                Set <code>ADMIN_PASSWORD</code> (12+ characters; the built-in <code>owner</code>{" "}
                sign-in) and <code>ADMIN_SESSION_SECRET</code> (32+ characters) in the Vercel
                project&apos;s environment variables.{" "}
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

function Dashboard({ data }: { data: Extract<AdminResult, { status: "ok" }> }) {
  const { doc, me, activity, accounts, contactsHidden } = data;
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const [confirmAll, setConfirmAll] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isOwner = me.role === "owner";
  const cad = useCadView(doc);
  // Converted numbers are display-only: no editing while the CAD view is on.
  const roleCanEdit = me.role !== "viewer";
  const canEdit = roleCanEdit && !cad.on;
  const view = cad.doc;
  const tabs = TABS.filter(
    (t) => (t.id !== "accounts" || isOwner) && (t.id !== "import" || roleCanEdit),
  );

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
    accounts: accounts?.length,
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
            Signed in as <strong>{me.name}</strong> · {ROLE_NAME[me.role]}
            {" · "}
            {doc.updatedAt
              ? `last change ${new Date(doc.updatedAt).toLocaleString("en-CA")}`
              : "nothing saved yet"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle />
          {cad.available && (
            <button
              type="button"
              onClick={cad.toggle}
              aria-pressed={cad.on}
              disabled={cad.loading}
              className={`pa-btn text-sm ${cad.on ? "" : "is-light"}`}
              title="Convert every USD amount to CAD at the Bank of Canada rate for its date"
            >
              {cad.loading ? "Getting rates…" : cad.on ? "Showing all in CAD" : "Show all in CAD"}
            </button>
          )}
          {!me.builtin && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-expanded={showPassword}
              className="pa-btn is-light text-sm"
            >
              My password
            </button>
          )}
          <button
            type="button"
            onClick={() => (confirmAll ? signOut(true) : setConfirmAll(true))}
            onBlur={() => setConfirmAll(false)}
            className="pa-btn is-light text-sm"
            title={
              isOwner
                ? "Ends every signed-in session for the whole team"
                : "Ends your sessions on every device"
            }
          >
            {confirmAll
              ? isOwner
                ? "Sure? Sign out the whole team"
                : "Sure? Sign out all my devices"
              : isOwner
                ? "Sign out everyone"
                : "Sign out everywhere"}
          </button>
          <button type="button" onClick={() => signOut()} className="pa-btn is-light text-sm">
            Sign out
          </button>
        </div>
      </header>

      {showPassword && (
        <div className="mt-4">
          <ChangePasswordForm me={me} forced={false} onDone={() => setShowPassword(false)} />
        </div>
      )}
      {contactsHidden && (
        <p className="pa-hand mt-3 text-muted-foreground">
          view-only account <span className="pa-star">✦</span> member contact details are hidden
        </p>
      )}

      {cad.error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {cad.error}
        </p>
      )}
      {cad.on && cad.latest && (
        <p className="pa-card mt-4 px-4 py-2 text-sm" role="status">
          <strong>All amounts in CAD.</strong> USD amounts are converted at the Bank of Canada daily
          rate for each row&apos;s date (latest: 1 USD = {cad.latest[1].toFixed(4)} CAD on{" "}
          {cad.latest[0]}). Editing is off in this view —{" "}
          <button type="button" className="underline" onClick={cad.toggle}>
            show original currencies
          </button>{" "}
          to make changes.
        </p>
      )}

      <nav role="tablist" aria-label="Admin sections" className="pa-tabs mt-6">
        {tabs.map((t) => (
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
        {tab === "overview" && <Overview doc={view} />}
        {tab === "items" && <ItemsTab doc={view} canEdit={canEdit} />}
        {tab === "orders" && <OrdersTab doc={view} canEdit={canEdit} />}
        {tab === "expenses" && <ExpensesTab doc={view} canEdit={canEdit} />}
        {tab === "income" && <IncomeTab doc={view} canEdit={canEdit} />}
        {tab === "members" && (
          <MembersTab doc={view} canEdit={canEdit} contactsHidden={contactsHidden} />
        )}
        {tab === "activity" && <ActivityPanel entries={activity} />}
        {tab === "import" && roleCanEdit && <ImportPanel doc={doc} isOwner={isOwner} />}
        {tab === "accounts" && accounts && <AccountsPanel accounts={accounts} me={me} />}
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

const CAD_VIEW_KEY = "plush-admin:cad-view";

/**
 * "Show all in CAD": fetches Bank of Canada USD→CAD rates (once per page load)
 * and returns a converted copy of the data. Remembers the choice per browser.
 */
function useCadView(doc: AdminDoc) {
  const available = hasUsd(doc);
  const [on, setOn] = useState(false);
  const [rates, setRates] = useState<FxRate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<boolean> {
    if (rates) return true;
    setLoading(true);
    setError(null);
    try {
      const start = earliestUsdDate(doc, todayIso()) ?? todayIso();
      const result = await getUsdCadRates({ data: { start } });
      if (!result.ok) {
        setError("Couldn't get exchange rates from the Bank of Canada. Try again in a minute.");
        return false;
      }
      setRates(result.rates);
      return true;
    } catch {
      setError("Couldn't get exchange rates. Check your connection and try again.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    const next = !on;
    if (next && !(await load())) return;
    setOn(next);
    try {
      localStorage.setItem(CAD_VIEW_KEY, next ? "1" : "0");
    } catch {
      // Private mode / blocked storage: the choice just isn't remembered.
    }
  }

  // Restore the last choice once the page is in the browser.
  useEffect(() => {
    let saved = false;
    try {
      saved = localStorage.getItem(CAD_VIEW_KEY) === "1";
    } catch {
      saved = false;
    }
    if (saved && available) void load().then((ok) => ok && setOn(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available]);

  const active = on && available && rates !== null;
  const converted = useMemo(
    () => (active && rates ? toCad(doc, rates) : doc),
    [active, rates, doc],
  );
  const latest: FxRate | null =
    rates && rates.length > 0 ? [rates[rates.length - 1][0], rateOn(rates, null)] : null;
  return { available, on: active, loading, error, toggle, doc: converted, latest };
}
