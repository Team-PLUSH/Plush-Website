import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  getRequestIP,
  setCookie,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { z } from "zod";

import {
  activity,
  BUILTIN_OWNER,
  endSession,
  endSessionsFor,
  findByUsername,
  getAccount,
  listAccounts,
  logActivity,
  putAccount,
  readActivity,
  removeAccount,
  ROLES,
  sessionAccountId,
  startSession,
  toPublic,
  type Account,
  type ActivityEntry,
  type PublicAccount,
  type Role,
} from "./admin-accounts";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  adminConfig,
  createSession,
  hashPassword,
  passwordMatches,
  readSessionToken,
  temporaryPassword,
  verifyPassword,
} from "./admin-auth";
import {
  AdminChangeError,
  COLLECTION_LIMITS,
  COLLECTIONS,
  collectionSchemas,
  loadAdminDoc,
  newId,
  updateAdminDoc,
  type AdminDoc,
  type Collection,
} from "./admin-store";
import { isRateLimited } from "./rate-limit";
import { upstashConfig, type UpstashConfig } from "./upstash";

// Team admin (inventory, orders, expenses, income, membership fees). None of
// this data is in the repo (the repo is public): it lives in the project's
// Upstash Redis and is only sent to a browser holding a live session. Every
// call checks the caller's role here, on the server. See admin-auth.ts for the
// env vars and admin-accounts.ts for the roles.

export type { AdminDoc, Collection, Expense, Income, Item, Member, Order } from "./admin-store";
export type { ActivityEntry, PublicAccount, Role } from "./admin-accounts";

export type Me = Pick<PublicAccount, "id" | "name" | "username" | "role"> & { builtin: boolean };

export type AdminResult =
  | {
      status: "ok";
      doc: AdminDoc;
      me: Me;
      activity: ActivityEntry[];
      accounts: PublicAccount[] | null;
      contactsHidden: boolean;
    }
  | { status: "signed-out" }
  | { status: "change-password"; me: Me }
  | { status: "not-configured"; missing: ("password" | "database")[] }
  | { status: "storage-error" };

export type LoginResult =
  { ok: true } | { ok: false; reason: "wrong" | "limited" | "not-configured" };

type Failure = {
  ok: false;
  reason: "signed-out" | "not-configured" | "forbidden" | "invalid" | "storage-error";
  message?: string;
};
export type MutationResult = { ok: true; added?: number } | Failure;
export type AccountResult = { ok: true; temporaryPassword?: string } | Failure;

const LOGIN_LIMITS_IP = { bucket: "admin-login", max: 10, windowMs: 15 * 60 * 1000 };
// Per-username cap on top of the per-IP one, against guessing from many IPs.
// Set well above the per-IP cap so one person can't lock someone else out
// (the built-in username "owner" is public).
const LOGIN_LIMITS_USER = { bucket: "admin-login-user", max: 50, windowMs: 15 * 60 * 1000 };
const MIN_PASSWORD = 12;

/** Admin responses carry private data: never cache them anywhere. */
function noStore() {
  setResponseHeader("Cache-Control", "no-store, private");
  setResponseHeader("X-Robots-Tag", "noindex, nofollow");
}

function missingConfig(): ("password" | "database")[] {
  const missing: ("password" | "database")[] = [];
  if (!adminConfig()) missing.push("password");
  if (!upstashConfig()) missing.push("database");
  return missing;
}

type Caller = { account: PublicAccount; sessionId: string; db: UpstashConfig };

/** Who is calling, from a live session; null if signed out or disabled. */
async function caller(): Promise<Caller | null> {
  const cfg = adminConfig();
  const db = upstashConfig();
  if (!cfg || !db) return null;
  const session = await readSessionToken(getCookie(ADMIN_COOKIE), cfg);
  if (!session) return null;
  try {
    const accountId = await sessionAccountId(db, session.id);
    if (!accountId) return null;
    if (accountId === BUILTIN_OWNER.id)
      return { account: BUILTIN_OWNER, sessionId: session.id, db };
    const account = await getAccount(db, accountId);
    if (!account || account.disabled) return null;
    return { account: toPublic(account), sessionId: session.id, db };
  } catch {
    return null; // can't check: treat as signed out
  }
}

const RANK: Record<Role, number> = { viewer: 0, editor: 1, owner: 2 };
const can = (who: PublicAccount, role: Role) => RANK[who.role] >= RANK[role];

function me(account: PublicAccount): Me {
  return {
    id: account.id,
    name: account.name,
    username: account.username,
    role: account.role,
    builtin: account.id === BUILTIN_OWNER.id,
  };
}

/** Member contact emails are only sent to owners and editors. */
function forRole(doc: AdminDoc, who: PublicAccount): AdminDoc {
  if (can(who, "editor")) return doc;
  return { ...doc, members: doc.members.map((m) => ({ ...m, contactEmail: null })) };
}

export const getAdminData = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminResult> => {
    noStore();
    const missing = missingConfig();
    if (missing.length > 0) return { status: "not-configured", missing };
    const who = await caller();
    if (!who) return { status: "signed-out" };
    if (who.account.mustChangePassword) return { status: "change-password", me: me(who.account) };
    try {
      const [doc, log, accounts] = await Promise.all([
        loadAdminDoc(who.db),
        readActivity(who.db),
        can(who.account, "owner") ? listAccounts(who.db) : Promise.resolve(null),
      ]);
      return {
        status: "ok",
        doc: forRole(doc, who.account),
        me: me(who.account),
        activity: log,
        accounts: accounts ? [BUILTIN_OWNER, ...accounts.map(toPublic)] : null,
        contactsHidden: !can(who.account, "editor"),
      };
    } catch (error) {
      console.error(`admin: load failed (${String(error).slice(0, 300)})`);
      return { status: "storage-error" };
    }
  },
);

export const adminLogin = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        username: z.string().trim().toLowerCase().max(60),
        password: z.string().max(200),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<LoginResult> => {
    noStore();
    const cfg = adminConfig();
    const db = upstashConfig();
    if (!cfg || !db) return { ok: false, reason: "not-configured" };

    const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    if (
      (await isRateLimited(ip, LOGIN_LIMITS_IP)) ||
      (await isRateLimited(data.username || "(blank)", LOGIN_LIMITS_USER))
    ) {
      return { ok: false, reason: "limited" };
    }

    let account: PublicAccount | null = null;
    if (data.username === BUILTIN_OWNER.username) {
      if (await passwordMatches(data.password, cfg)) account = BUILTIN_OWNER;
    } else {
      const found = await findByUsername(db, data.username);
      // verifyPassword does the same work for unknown users (no timing hint).
      const okPassword = await verifyPassword(data.password, found?.hash ?? null);
      if (found && okPassword && !found.disabled) account = toPublic(found);
    }

    if (!account) {
      console.warn(JSON.stringify({ event: "admin-login-failed", at: new Date().toISOString() }));
      return { ok: false, reason: "wrong" };
    }

    const session = await createSession(cfg);
    await startSession(db, session.id, account.id, session.expires);
    await logActivity(db, activity(account, "signed in", ""));
    setCookie(ADMIN_COOKIE, session.token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: ADMIN_SESSION_SECONDS,
    });
    return { ok: true };
  });

export const adminLogout = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({ everywhere: z.boolean().default(false) })
      .default({ everywhere: false })
      .parse(data),
  )
  .handler(async ({ data }) => {
    noStore();
    const who = await caller();
    if (who) {
      try {
        if (!data.everywhere) {
          await endSession(who.db, who.sessionId);
        } else if (can(who.account, "owner")) {
          // An owner's "everywhere" signs the whole team out.
          await endSessionsFor(who.db, null);
          await logActivity(who.db, activity(who.account, "signed everyone out", ""));
        } else {
          await endSessionsFor(who.db, who.account.id);
        }
      } catch {
        // cookie is still cleared below
      }
    }
    deleteCookie(ADMIN_COOKIE, { httpOnly: true, secure: true, sameSite: "strict", path: "/" });
    return { ok: true as const };
  });

export const changeMyPassword = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ current: z.string().max(200), next: z.string().max(200) }).parse(data),
  )
  .handler(async ({ data }): Promise<AccountResult> => {
    noStore();
    const who = await caller();
    if (!who) return { ok: false, reason: "signed-out" };
    if (who.account.id === BUILTIN_OWNER.id) {
      return {
        ok: false,
        reason: "invalid",
        message: "The shared owner password is changed in Vercel (ADMIN_PASSWORD).",
      };
    }
    const account = await getAccount(who.db, who.account.id);
    if (!account || !(await verifyPassword(data.current, account.hash))) {
      return { ok: false, reason: "invalid", message: "Your current password isn't right." };
    }
    if (data.next.length < MIN_PASSWORD) {
      return {
        ok: false,
        reason: "invalid",
        message: `Use at least ${MIN_PASSWORD} characters.`,
      };
    }
    if (data.next === data.current) {
      return { ok: false, reason: "invalid", message: "Pick a new password." };
    }
    await putAccount(who.db, {
      ...account,
      hash: await hashPassword(data.next),
      mustChangePassword: false,
    });
    await endSessionsFor(who.db, account.id, who.sessionId); // other devices signed out
    await logActivity(who.db, activity(who.account, "changed their password", ""));
    return { ok: true };
  });

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,40}$/, "3–40 letters, numbers, dots, dashes or underscores");

const accountOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create"),
    name: z.string().trim().min(1, "Required").max(80),
    username: usernameSchema,
    role: z.enum(ROLES),
  }),
  z.object({ op: z.literal("resetPassword"), id: z.string().max(64) }),
  z.object({ op: z.literal("setRole"), id: z.string().max(64), role: z.enum(ROLES) }),
  z.object({ op: z.literal("setDisabled"), id: z.string().max(64), disabled: z.boolean() }),
  z.object({ op: z.literal("delete"), id: z.string().max(64) }),
]);
export type AccountOp = z.input<typeof accountOpSchema>;

export const manageAccounts = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ op: z.string() }).passthrough().parse(data))
  .handler(async ({ data }): Promise<AccountResult> => {
    noStore();
    const who = await caller();
    if (!who) return { ok: false, reason: "signed-out" };
    if (!can(who.account, "owner") || who.account.mustChangePassword) {
      return { ok: false, reason: "forbidden", message: "Only owners can manage accounts." };
    }
    const parsed = accountOpSchema.safeParse(data);
    if (!parsed.success) return { ok: false, reason: "invalid", message: describe(parsed.error) };
    const op = parsed.data;
    const { db } = who;

    if (op.op === "create") {
      if (op.username === BUILTIN_OWNER.username || (await findByUsername(db, op.username))) {
        return { ok: false, reason: "invalid", message: "That username is taken." };
      }
      const password = temporaryPassword();
      const account: Account = {
        id: newId(),
        username: op.username,
        name: op.name,
        role: op.role,
        hash: await hashPassword(password),
        disabled: false,
        mustChangePassword: true,
        createdAt: new Date().toISOString(),
        createdBy: who.account.name,
      };
      await putAccount(db, account);
      await logActivity(db, activity(who.account, "created account", `${op.name} (${op.role})`));
      return { ok: true, temporaryPassword: password };
    }

    if (op.id === BUILTIN_OWNER.id) {
      return {
        ok: false,
        reason: "invalid",
        message: "The built-in owner is managed in Vercel (ADMIN_PASSWORD).",
      };
    }
    if (op.id === who.account.id && op.op !== "resetPassword") {
      return {
        ok: false,
        reason: "invalid",
        message: "You can't change your own role or access. Ask another owner.",
      };
    }
    const target = await getAccount(db, op.id);
    if (!target) return { ok: false, reason: "invalid", message: "That account no longer exists." };

    switch (op.op) {
      case "resetPassword": {
        const password = temporaryPassword();
        await putAccount(db, {
          ...target,
          hash: await hashPassword(password),
          mustChangePassword: true,
        });
        await endSessionsFor(db, target.id);
        await logActivity(db, activity(who.account, "reset password for", target.name));
        return { ok: true, temporaryPassword: password };
      }
      case "setRole":
        await putAccount(db, { ...target, role: op.role });
        await logActivity(
          db,
          activity(who.account, "changed role", `${target.name}: ${target.role} → ${op.role}`),
        );
        return { ok: true };
      case "setDisabled":
        await putAccount(db, { ...target, disabled: op.disabled });
        if (op.disabled) await endSessionsFor(db, target.id);
        await logActivity(
          db,
          activity(
            who.account,
            op.disabled ? "turned off account" : "turned on account",
            target.name,
          ),
        );
        return { ok: true };
      case "delete":
        await removeAccount(db, target.id);
        await endSessionsFor(db, target.id);
        await logActivity(db, activity(who.account, "deleted account", target.name));
        return { ok: true };
    }
  });

const collection = z.enum(["items", "orders", "expenses", "income", "members"]);

// Values arrive unvalidated and are checked in the handler, so a bad field comes
// back as a readable message rather than a thrown error.
const mutationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("save"),
    collection,
    id: z.string().max(64).nullable(),
    value: z.unknown(),
  }),
  z.object({ op: z.literal("delete"), collection, id: z.string().max(64) }),
  z.object({
    op: z.literal("import"),
    mode: z.enum(["append", "replace"]),
    json: z.string().max(1_000_000),
  }),
]);

export type MutationInput = z.input<typeof mutationSchema>;

function describe(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue?.path.length ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue?.message ?? "invalid"}`;
}

const importSchema = z
  .object({
    items: z.array(collectionSchemas.items).max(COLLECTION_LIMITS.items).default([]),
    orders: z.array(collectionSchemas.orders).max(COLLECTION_LIMITS.orders).default([]),
    expenses: z.array(collectionSchemas.expenses).max(COLLECTION_LIMITS.expenses).default([]),
    income: z.array(collectionSchemas.income).max(COLLECTION_LIMITS.income).default([]),
    members: z.array(collectionSchemas.members).max(COLLECTION_LIMITS.members).default([]),
  })
  .passthrough();

const NOUN: Record<Collection, string> = {
  items: "item",
  orders: "order",
  expenses: "expense",
  income: "grant/sponsor entry",
  members: "member",
};

/** A short, readable name for a row, for the activity log. */
function label(collection: Collection, row: Record<string, unknown> | undefined): string {
  if (!row) return NOUN[collection];
  const name =
    row.item ?? row.description ?? row.name ?? row.source ?? row.supplier ?? NOUN[collection];
  return `${NOUN[collection]}: ${String(name).slice(0, 80)}`;
}

export const mutateAdminData = createServerFn({ method: "POST" })
  .validator((data: unknown) => mutationSchema.parse(data))
  .handler(async ({ data }): Promise<MutationResult> => {
    noStore();
    if (missingConfig().length > 0) return { ok: false, reason: "not-configured" };
    const who = await caller();
    if (!who) return { ok: false, reason: "signed-out" };
    if (!can(who.account, "editor") || who.account.mustChangePassword) {
      return { ok: false, reason: "forbidden", message: "Your account can only view." };
    }
    if (data.op === "import" && data.mode === "replace" && !can(who.account, "owner")) {
      return { ok: false, reason: "forbidden", message: "Only owners can replace whole lists." };
    }
    const { db, account } = who;
    const now = new Date().toISOString();

    try {
      if (data.op === "save") {
        const parsed = collectionSchemas[data.collection].safeParse(data.value);
        if (!parsed.success) {
          return { ok: false, reason: "invalid", message: describe(parsed.error) };
        }
        await updateAdminDoc(
          db,
          (doc) => {
            const rows = doc[data.collection] as Record<string, unknown>[];
            if (data.id === null) {
              rows.push({ ...parsed.data, id: newId(), createdBy: account.name, createdAt: now });
            } else {
              const index = rows.findIndex((r) => r.id === data.id);
              if (index < 0) throw new AdminChangeError("Someone else deleted that row.");
              const before = rows[index];
              rows[index] = {
                ...parsed.data,
                id: data.id,
                createdBy: before.createdBy,
                createdAt: before.createdAt,
                updatedBy: account.name,
                updatedAt: now,
              };
            }
            return doc;
          },
          () =>
            activity(
              account,
              data.id === null ? "added" : "edited",
              label(data.collection, parsed.data as Record<string, unknown>),
            ),
        );
        return { ok: true };
      }

      if (data.op === "delete") {
        let removed: Record<string, unknown> | undefined;
        await updateAdminDoc(
          db,
          (doc) => {
            const rows = doc[data.collection] as Record<string, unknown>[];
            removed = rows.find((r) => r.id === data.id);
            return { ...doc, [data.collection]: rows.filter((r) => r.id !== data.id) };
          },
          (before) =>
            activity(
              account,
              "deleted",
              label(
                data.collection,
                (before[data.collection] as Record<string, unknown>[]).find(
                  (r) => r.id === data.id,
                ) ?? removed,
              ),
            ),
        );
        return { ok: true };
      }

      let raw: unknown;
      try {
        raw = JSON.parse(data.json);
      } catch {
        return { ok: false, reason: "invalid", message: "That isn't valid JSON." };
      }
      const parsed = importSchema.safeParse(raw);
      if (!parsed.success) return { ok: false, reason: "invalid", message: describe(parsed.error) };
      const incoming = Object.fromEntries(
        COLLECTIONS.map((c) => [
          c,
          (parsed.data[c] as object[]).map((r) => ({
            ...r,
            id: newId(),
            createdBy: account.name,
            createdAt: now,
          })),
        ]),
      ) as unknown as Record<(typeof COLLECTIONS)[number], { id: string }[]>;
      const added = COLLECTIONS.reduce((n, c) => n + incoming[c].length, 0);
      if (added === 0) return { ok: false, reason: "invalid", message: "Nothing to import." };
      const summary = COLLECTIONS.filter((c) => incoming[c].length)
        .map((c) => `${incoming[c].length} ${c}`)
        .join(", ");

      await updateAdminDoc(
        db,
        (doc) => {
          const next = { ...doc };
          for (const c of COLLECTIONS) {
            // Replace only swaps the lists the import actually contains.
            const keep = data.mode === "replace" && incoming[c].length > 0 ? [] : doc[c];
            (next as Record<string, unknown>)[c] = [...keep, ...incoming[c]];
          }
          return next;
        },
        () =>
          activity(account, data.mode === "replace" ? "replaced with import" : "imported", summary),
      );
      return { ok: true, added };
    } catch (error) {
      if (error instanceof AdminChangeError) {
        return { ok: false, reason: "invalid", message: error.message };
      }
      console.error(`admin: save failed (${String(error).slice(0, 300)})`);
      return { ok: false, reason: "storage-error" };
    }
  });

// ---- USD → CAD exchange rates ----------------------------------------------

/** One Bank of Canada daily rate: [YYYY-MM-DD, CAD per 1 USD]. */
export type FxRate = [string, number];
export type FxResult =
  { ok: true; rates: FxRate[] } | { ok: false; reason: "signed-out" | "unavailable" };

// The Bank of Canada's FXUSDCAD series starts on 2017-01-03.
const FX_FIRST_DATE = "2017-01-03";
const FX_CACHE_MS = 6 * 60 * 60 * 1000;
const fxCache = new Map<string, { at: number; rates: FxRate[] }>();

/**
 * Daily USD→CAD rates from the Bank of Canada (official, free, no key) from
 * `start` to today, for the admin's "Show in CAD" view. Fetched server-side —
 * the page's CSP allows no third-party connections — and cached per instance.
 */
export const getUsdCadRates = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    z.object({ start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(data),
  )
  .handler(async ({ data }): Promise<FxResult> => {
    noStore();
    if (!(await caller())) return { ok: false, reason: "signed-out" };

    // Start a week early so a weekend / holiday purchase has a prior rate.
    const wanted = new Date(`${data.start}T00:00:00Z`);
    wanted.setUTCDate(wanted.getUTCDate() - 7);
    const start = [wanted.toISOString().slice(0, 10), FX_FIRST_DATE].sort()[1];

    const cached = fxCache.get(start);
    if (cached && Date.now() - cached.at < FX_CACHE_MS) return { ok: true, rates: cached.rates };

    try {
      const res = await fetch(
        `https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?start_date=${start}`,
        { signal: AbortSignal.timeout(8_000) },
      );
      if (!res.ok) throw new Error(`Bank of Canada ${res.status}`);
      const body = (await res.json()) as {
        observations?: { d?: string; FXUSDCAD?: { v?: string } }[];
      };
      const rates: FxRate[] = (body.observations ?? [])
        .map((o): FxRate => [o.d ?? "", Number(o.FXUSDCAD?.v)])
        .filter(([d, v]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && v > 0.5 && v < 3)
        .sort((a, b) => (a[0] < b[0] ? -1 : 1));
      if (rates.length === 0) throw new Error("Bank of Canada returned no rates");
      fxCache.set(start, { at: Date.now(), rates });
      return { ok: true, rates };
    } catch (error) {
      console.warn(`admin: exchange rates unavailable (${String(error).slice(0, 200)})`);
      return { ok: false, reason: "unavailable" };
    }
  });
