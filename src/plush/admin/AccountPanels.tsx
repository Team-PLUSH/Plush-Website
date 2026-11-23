import { useRouter } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";

import {
  changeMyPassword,
  manageAccounts,
  type AccountOp,
  type AccountResult,
  type ActivityEntry,
  type Me,
  type PublicAccount,
  type Role,
} from "@/plush/admin.functions";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};
const ROLE_HELP: Record<Role, string> = {
  owner: "everything, including accounts",
  editor: "add, edit and delete records",
  viewer: "read only; can't see member contact emails",
};

function failureText(result: AccountResult): string | null {
  if (result.ok) return null;
  return result.message ?? "That didn't work. Try again.";
}

// ---- Change password ---------------------------------------------------------

export function ChangePasswordForm({
  me,
  forced,
  onDone,
}: {
  me: Me;
  forced: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (next !== again) {
      setMessage({ ok: false, text: "The two new passwords don't match." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await changeMyPassword({ data: { current, next } });
      if (result.ok) {
        setCurrent("");
        setNext("");
        setAgain("");
        setMessage({ ok: true, text: "Password changed. Other devices were signed out." });
        await router.invalidate();
        onDone?.();
      } else if (result.reason === "signed-out") {
        await router.invalidate();
      } else {
        setMessage({ ok: false, text: failureText(result) ?? "" });
      }
    } catch {
      setMessage({ ok: false, text: "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 w-full px-3 py-2 text-sm";
  return (
    <form
      onSubmit={onSubmit}
      className={`pa-card p-6 ${forced ? "mx-auto mt-16 max-w-sm" : "max-w-md"}`}
    >
      <h2 className="pa-title text-xl">
        {forced ? `Welcome, ${me.name}!` : "Change your password"}
      </h2>
      {forced && (
        <p className="mt-1 text-sm text-muted-foreground">
          Pick your own password to finish setting up your account.
        </p>
      )}
      {/* Lets password managers save the new password against the right username. */}
      <input type="hidden" autoComplete="username" value={me.username} readOnly />
      <label htmlFor="pw-current" className="mt-4 block text-sm font-bold">
        {forced ? "One-time password you were given" : "Current password"}
      </label>
      <input
        id="pw-current"
        type="password"
        autoComplete="current-password"
        required
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        className={field}
      />
      <label htmlFor="pw-new" className="mt-3 block text-sm font-bold">
        New password
      </label>
      <input
        id="pw-new"
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
        value={next}
        onChange={(e) => setNext(e.target.value)}
        className={field}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        At least 12 characters. A short sentence is easy to remember and hard to guess.
      </p>
      <label htmlFor="pw-again" className="mt-3 block text-sm font-bold">
        New password again
      </label>
      <input
        id="pw-again"
        type="password"
        autoComplete="new-password"
        required
        value={again}
        onChange={(e) => setAgain(e.target.value)}
        className={field}
      />
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`mt-3 text-sm ${message.ok ? "text-green-700 dark:text-green-400" : "text-destructive"}`}
        >
          {message.text}
        </p>
      )}
      <button type="submit" disabled={busy} className="pa-btn mt-4 w-full text-sm">
        {busy ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}

// ---- Accounts (owners) -------------------------------------------------------

export function AccountsPanel({ accounts, me }: { accounts: PublicAccount[]; me: Me }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<{ name: string; username: string; password: string } | null>(
    null,
  );
  const [confirm, setConfirm] = useState<string | null>(null);

  async function run(op: AccountOp, who: { name: string; username: string }) {
    setBusy(true);
    setError(null);
    try {
      const result = await manageAccounts({ data: op });
      if (result.ok) {
        setConfirm(null);
        if (result.temporaryPassword) {
          setShown({ ...who, password: result.temporaryPassword });
        }
        await router.invalidate();
        return true;
      }
      if (result.reason === "signed-out") await router.invalidate();
      setError(failureText(result));
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
    return false;
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const ok = await run({ op: "create", name, username, role }, { name, username });
    if (ok) {
      setName("");
      setUsername("");
    }
  }

  const field = "mt-1 w-full px-3 py-2 text-sm";
  return (
    <section className="space-y-6">
      {shown && (
        <div className="pa-card is-green p-4" role="status">
          <h3 className="pa-title">One-time password for {shown.name}</h3>
          <p className="mt-1 text-sm">
            Username <strong>{shown.username}</strong> · password{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-base">{shown.password}</code>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Give this to them in person or by direct message. It only works until they sign in and
            choose their own, and it won&apos;t be shown again.
          </p>
          <button
            type="button"
            onClick={() => setShown(null)}
            className="pa-btn is-light mt-3 text-sm"
          >
            Done
          </button>
        </div>
      )}

      <form onSubmit={onCreate} className="pa-card is-purple p-4">
        <h2 className="pa-title text-xl">Add a person</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="acct-name" className="block text-sm font-bold">
              Name
            </label>
            <input
              id="acct-name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label htmlFor="acct-username" className="block text-sm font-bold">
              Username
            </label>
            <input
              id="acct-username"
              required
              autoCapitalize="none"
              spellCheck={false}
              pattern="[a-zA-Z0-9._\-]{3,40}"
              placeholder="e.g. alex.l"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label htmlFor="acct-role" className="block text-sm font-bold">
              Role
            </label>
            <select
              id="acct-role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className={field}
            >
              {(["editor", "viewer", "owner"] as const).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]} — {ROLE_HELP[r]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="pa-btn mt-4 text-sm">
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>

      <div className="pa-card pa-table overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const builtin = a.id === "owner";
              const self = a.id === me.id;
              const key = (action: string) => `${action}:${a.id}`;
              return (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    {a.name}
                    {self && <span className="text-xs text-muted-foreground"> (you)</span>}
                    {a.createdBy && (
                      <div className="text-xs text-muted-foreground">
                        added by {a.createdBy} {a.createdAt.slice(0, 10)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{a.username}</td>
                  <td className="px-3 py-2">
                    {builtin || self ? (
                      ROLE_LABEL[a.role]
                    ) : (
                      <select
                        aria-label={`Role for ${a.name}`}
                        value={a.role}
                        disabled={busy}
                        onChange={(e) =>
                          void run({ op: "setRole", id: a.id, role: e.target.value as Role }, a)
                        }
                        className="px-2 py-1 text-sm"
                      >
                        {(["owner", "editor", "viewer"] as const).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {builtin
                      ? "Built in (password set in Vercel)"
                      : a.disabled
                        ? "Turned off"
                        : a.mustChangePassword
                          ? "Waiting for first sign-in"
                          : "Active"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {!builtin && (
                      <>
                        <ConfirmButton
                          armed={confirm === key("reset")}
                          onArm={() => setConfirm(key("reset"))}
                          onConfirm={() => void run({ op: "resetPassword", id: a.id }, a)}
                          label="Reset password"
                          disabled={busy}
                        />
                        {!self && (
                          <>
                            <ConfirmButton
                              armed={confirm === key("toggle")}
                              onArm={() => setConfirm(key("toggle"))}
                              onConfirm={() =>
                                void run({ op: "setDisabled", id: a.id, disabled: !a.disabled }, a)
                              }
                              label={a.disabled ? "Turn on" : "Turn off"}
                              disabled={busy}
                            />
                            <ConfirmButton
                              armed={confirm === key("delete")}
                              onArm={() => setConfirm(key("delete"))}
                              onConfirm={() => void run({ op: "delete", id: a.id }, a)}
                              label="Delete"
                              danger
                              disabled={busy}
                            />
                          </>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Resetting a password, turning an account off or deleting it signs that person out everywhere
        straight away.
      </p>
    </section>
  );
}

function ConfirmButton({
  armed,
  onArm,
  onConfirm,
  label,
  danger,
  disabled,
}: {
  armed: boolean;
  onArm: () => void;
  onConfirm: () => void;
  label: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return armed ? (
    <button
      type="button"
      disabled={disabled}
      onClick={onConfirm}
      className="pa-btn is-danger ml-1 px-2 py-0.5 text-xs"
    >
      Sure? {label}
    </button>
  ) : (
    <button
      type="button"
      onClick={onArm}
      className={`ml-1 rounded px-2 py-1 text-xs hover:bg-accent ${danger ? "text-destructive" : ""}`}
    >
      {label}
    </button>
  );
}

// ---- Activity ----------------------------------------------------------------

export function ActivityPanel({ entries }: { entries: ActivityEntry[] }) {
  const [person, setPerson] = useState("");
  const people = useMemo(() => [...new Set(entries.map((e) => e.by))].sort(), [entries]);
  const shown = person ? entries.filter((e) => e.by === person) : entries;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="pa-title text-xl">Activity</h2>
          <p className="text-sm text-muted-foreground">
            Who changed what, newest first (last {entries.length} changes and sign-ins).
          </p>
        </div>
        <select
          aria-label="Filter by person"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          className="px-2 py-1.5 text-sm"
        >
          <option value="">Everyone</option>
          {people.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="pa-card pa-table mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Who</th>
              <th className="px-3 py-2">What</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((e, i) => (
              <tr key={`${e.at}-${i}`} className="border-t border-border">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                  {new Date(e.at).toLocaleString("en-CA")}
                </td>
                <td className="px-3 py-2">{e.by}</td>
                <td className="px-3 py-2">
                  {e.action}
                  {e.detail && <span className="text-muted-foreground"> {e.detail}</span>}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                  Nothing yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
