import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { adminLogout, getAdminData, type AdminResult } from "@/plush/admin.functions";
import { AccountsPanel, ActivityPanel, ChangePasswordForm } from "@/plush/admin/AccountPanels";
import { ImportPanel, LoginForm, Overview } from "@/plush/admin/Panels";
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
  const canEdit = me.role !== "viewer";
  const isOwner = me.role === "owner";
  const tabs = TABS.filter(
    (t) => (t.id !== "accounts" || isOwner) && (t.id !== "import" || canEdit),
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
        {tab === "overview" && <Overview doc={doc} />}
        {tab === "items" && <ItemsTab doc={doc} canEdit={canEdit} />}
        {tab === "orders" && <OrdersTab doc={doc} canEdit={canEdit} />}
        {tab === "expenses" && <ExpensesTab doc={doc} canEdit={canEdit} />}
        {tab === "income" && <IncomeTab doc={doc} canEdit={canEdit} />}
        {tab === "members" && (
          <MembersTab doc={doc} canEdit={canEdit} contactsHidden={contactsHidden} />
        )}
        {tab === "activity" && <ActivityPanel entries={activity} />}
        {tab === "import" && canEdit && <ImportPanel doc={doc} isOwner={isOwner} />}
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
