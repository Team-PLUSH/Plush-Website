import { useRouter } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";

import {
  adminLogin,
  mutateAdminData,
  type AdminDoc,
  type LoginResult,
} from "@/plush/admin.functions";
import { EXPENSE_CATEGORIES } from "@/plush/admin-options";

import { mixedMoney, money, round2, todayIso, totalsByCurrency, type Currency } from "./format";
import { itemSavings, memberOwing } from "./calc";

// ---- Overview ------------------------------------------------------------

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  tone?: "blue" | "purple" | "green";
}) {
  return (
    <div className={`pa-card pa-stat p-4 ${tone ? `is-${tone}` : ""}`}>
      <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="pa-title mt-1 text-2xl tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pa-card p-4">
      <h3 className="pa-title">{title}</h3>
      <div className="mt-2 text-sm">{children}</div>
    </div>
  );
}

export function Overview({ doc }: { doc: AdminDoc }) {
  const today = todayIso();
  const received = totalsByCurrency(
    doc.income,
    (r) => r.amount,
    (r) => r.status === "Received",
  );
  const pledged = totalsByCurrency(
    doc.income,
    (r) => r.amount,
    (r) => r.status === "Pledged",
  );
  const fees = round2(doc.members.reduce((t, m) => t + m.amountPaid, 0));
  // Store purchases are counted from their order/receipt (which includes tax
  // and shipping); purchases from other teams have no order, so count those
  // straight from the inventory.
  const storeOrders = totalsByCurrency(doc.orders, (o) => o.total);
  const fromTeams = totalsByCurrency(
    doc.items,
    (i) => i.total,
    (i) => i.source === "team",
  );
  const parts = {
    CAD: round2(storeOrders.CAD + fromTeams.CAD),
    USD: round2(storeOrders.USD + fromTeams.USD),
  };
  const expenses = totalsByCurrency(doc.expenses, (e) => e.total);
  const moneyIn = { CAD: round2(received.CAD + fees), USD: received.USD };
  const moneyOut = { CAD: round2(parts.CAD + expenses.CAD), USD: round2(parts.USD + expenses.USD) };
  const net = {
    CAD: round2(moneyIn.CAD - moneyOut.CAD),
    USD: round2(moneyIn.USD - moneyOut.USD),
  };

  const owing = doc.members.filter((m) => memberOwing(m) > 0);
  const saved = totalsByCurrency(doc.items, itemSavings);

  const outOfPocket = [
    ...doc.orders.map((o) => ({
      who: o.paidBy,
      what: `${o.supplier} order`,
      total: o.total,
      currency: o.currency,
      method: o.paymentMethod,
      reimbursed: o.reimbursed,
    })),
    ...doc.expenses.map((e) => ({
      who: e.paidBy,
      what: e.description,
      total: e.total,
      currency: e.currency,
      method: e.paymentMethod,
      reimbursed: e.reimbursed,
    })),
  ].filter(
    (r) =>
      !r.reimbursed && (r.method === "Personal card (reimburse)" || (!r.method && Boolean(r.who))),
  );

  const reports = doc.income
    .filter((r) => r.reportDue && r.status !== "Declined")
    .sort((a, b) => (a.reportDue ?? "").localeCompare(b.reportDue ?? ""));

  const byCategory = EXPENSE_CATEGORIES.map((c) => ({
    category: c,
    totals: totalsByCurrency(
      doc.expenses,
      (e) => e.total,
      (e) => e.category === c,
    ),
  })).filter((r) => r.totals.CAD || r.totals.USD);

  const currencies: Currency[] = moneyIn.USD || moneyOut.USD ? ["CAD", "USD"] : ["CAD"];

  return (
    <section className="space-y-6">
      {currencies.map((c) => (
        <div key={c}>
          {currencies.length > 1 && <h2 className="pa-hand mb-2">{c}</h2>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              tone="green"
              label="Money in"
              value={money(moneyIn[c], c)}
              sub={
                c === "CAD"
                  ? `${money(received.CAD)} grants & sponsors · ${money(fees)} member fees`
                  : "grants & sponsors"
              }
            />
            <Stat
              tone="blue"
              label="Money out"
              value={money(moneyOut[c], c)}
              sub={`${money(storeOrders[c], c)} store orders · ${money(fromTeams[c], c)} from teams · ${money(expenses[c], c)} expenses`}
            />
            <Stat tone="purple" label="Net" value={money(net[c], c)} sub="money in − money out" />
            <Stat label="Pledged, not received" value={money(pledged[c], c)} />
          </div>
        </div>
      ))}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Membership fees still owed (${owing.length})`}>
          {owing.length === 0 ? (
            <p className="text-muted-foreground">Everyone is paid up.</p>
          ) : (
            <ul className="space-y-1">
              {owing.map((m) => (
                <li key={m.id} className="flex justify-between gap-3">
                  <span>
                    {m.name} <span className="text-muted-foreground">· {m.season}</span>
                  </span>
                  <span className="tabular-nums text-destructive">{money(memberOwing(m))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Owed back to people who paid (${outOfPocket.length})`}>
          {outOfPocket.length === 0 ? (
            <p className="text-muted-foreground">Nobody is waiting to be paid back.</p>
          ) : (
            <ul className="space-y-1">
              {outOfPocket.map((r, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    {r.who ?? "Unknown"} <span className="text-muted-foreground">· {r.what}</span>
                  </span>
                  <span className="tabular-nums">{money(r.total, r.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Grant reports & sponsor follow-ups">
          {reports.length === 0 ? (
            <p className="text-muted-foreground">No deadlines recorded.</p>
          ) : (
            <ul className="space-y-1">
              {reports.map((r) => (
                <li key={r.id} className="flex justify-between gap-3">
                  <span>
                    {r.source}
                    {r.program && <span className="text-muted-foreground"> · {r.program}</span>}
                  </span>
                  <span
                    className={`whitespace-nowrap ${r.reportDue! < today ? "text-destructive" : ""}`}
                  >
                    {r.reportDue! < today ? "overdue " : "due "}
                    {r.reportDue}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Where the money went">
          <ul className="space-y-1">
            <li className="flex justify-between gap-3">
              <span>Parts & tools (store orders + team purchases)</span>
              <span className="tabular-nums">{mixedMoney(parts)}</span>
            </li>
            {byCategory.map((r) => (
              <li key={r.category} className="flex justify-between gap-3">
                <span>{r.category}</span>
                <span className="tabular-nums">{mixedMoney(r.totals)}</span>
              </li>
            ))}
          </ul>
          {(saved.CAD > 0 || saved.USD > 0) && (
            <p className="mt-3 text-green-700 dark:text-green-400">
              Saved {mixedMoney(saved)} by buying from other teams.
            </p>
          )}
        </Card>
      </div>
    </section>
  );
}

// ---- Import / backup -----------------------------------------------------

export function ImportPanel({ doc, isOwner }: { doc: AdminDoc; isOwner: boolean }) {
  const router = useRouter();
  const [json, setJson] = useState("");
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (mode === "replace" && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await mutateAdminData({ data: { op: "import", mode, json } });
      if (result.ok) {
        setMessage({ ok: true, text: `Imported ${result.added} rows.` });
        setJson("");
        setConfirmReplace(false);
        await router.invalidate();
      } else if (result.reason === "signed-out") {
        await router.invalidate();
      } else {
        setMessage({ ok: false, text: result.message ?? "Import failed." });
      }
    } catch {
      setMessage({ ok: false, text: "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  }

  function downloadBackup() {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-plush-admin-${todayIso()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-6">
      <form onSubmit={onSubmit} className="pa-card p-4">
        <h2 className="pa-title text-xl">Import</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a block of rows in JSON — Claude can make one from your receipts. It can hold any of{" "}
          <code>items</code>, <code>orders</code>, <code>expenses</code>, <code>income</code> and{" "}
          <code>members</code>. Every row is checked before anything is saved.
        </p>
        <textarea
          aria-label="Rows to import (JSON)"
          value={json}
          onChange={(e) => {
            setJson(e.target.value);
            setConfirmReplace(false);
          }}
          rows={10}
          placeholder='{"items": [{"item": "...", "cost": 0, "quantity": 1, "supplier": "...", "currency": "CAD"}]}'
          className="mt-3 w-full px-3 py-2 font-mono text-xs"
        />
        <fieldset className="mt-3 flex flex-wrap gap-4 text-sm">
          <legend className="sr-only">Import mode</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              checked={mode === "append"}
              onChange={() => {
                setMode("append");
                setConfirmReplace(false);
              }}
            />
            Add to what's there
          </label>
          {isOwner && (
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
              />
              Replace the lists in this import
            </label>
          )}
        </fieldset>
        {confirmReplace && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            This deletes every existing row in the lists this import contains. Click again to
            confirm.
          </p>
        )}
        {message && (
          <p
            role="status"
            className={`mt-3 text-sm ${message.ok ? "text-green-700 dark:text-green-400" : "text-destructive"}`}
          >
            {message.text}
          </p>
        )}
        <button type="submit" disabled={busy || json.trim() === ""} className="pa-btn mt-3 text-sm">
          {busy ? "Importing…" : confirmReplace ? "Yes, replace" : "Import"}
        </button>
      </form>

      <div className="pa-card p-4">
        <h2 className="pa-title text-xl">Backup</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Downloads everything as one file. The last 50 versions are also kept automatically in the
          database.
        </p>
        <button type="button" onClick={downloadBackup} className="pa-btn is-light mt-3 text-sm">
          Download backup
        </button>
      </div>
    </section>
  );
}

// ---- Sign in -------------------------------------------------------------

const LOGIN_MESSAGES: Record<Exclude<LoginResult, { ok: true }>["reason"], string> = {
  wrong: "That username or password isn't right.",
  limited: "Too many attempts. Try again in 15 minutes.",
  "not-configured": "The admin password hasn't been set up yet.",
};

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await adminLogin({ data: { username, password } });
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
    <form onSubmit={onSubmit} className="pa-card mx-auto mt-16 max-w-sm p-6 text-center">
      <div className="pa-mascots" aria-hidden="true">
        <span>🐱</span>
        <span>🐰</span>
        <span>🐻</span>
      </div>
      <h1 className="pa-title mt-4 text-2xl">Team PLUSH · Admin</h1>
      <p className="pa-hand mt-1 text-muted-foreground">
        team leads only <span className="pa-star">✦</span> no peeking!
      </p>
      <label htmlFor="admin-username" className="mt-5 block text-left text-sm font-bold">
        Username
      </label>
      <input
        id="admin-username"
        type="text"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="mt-1 w-full px-3 py-2 text-sm"
      />
      <label htmlFor="admin-password" className="mt-3 block text-left text-sm font-bold">
        Password
      </label>
      <input
        id="admin-password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-1 w-full px-3 py-2 text-sm"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || password === "" || username.trim() === ""}
        className="pa-btn mt-5 w-full text-sm"
      >
        {busy ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
