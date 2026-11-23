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
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  adminConfig,
  createSession,
  passwordMatches,
  readSessionToken,
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
} from "./admin-store";
import { isRateLimited } from "./rate-limit";
import { upstashConfig, upstashPipeline } from "./upstash";

// Team admin (inventory, orders, expenses, income, membership fees). None of this data is in the
// repo (the repo is public): it lives in the project's Upstash Redis and is only
// sent to a browser holding a valid signed session cookie. See
// src/plush/admin-auth.ts for the env vars the sign-in needs.

export type { AdminDoc, Collection, Expense, Income, Item, Member, Order } from "./admin-store";

export type AdminResult =
  | { status: "ok"; doc: AdminDoc }
  | { status: "signed-out" }
  | { status: "not-configured"; missing: ("password" | "database")[] }
  | { status: "storage-error" };

export type LoginResult =
  { ok: true } | { ok: false; reason: "wrong" | "limited" | "not-configured" };

export type MutationResult =
  | { ok: true; added?: number }
  | {
      ok: false;
      reason: "signed-out" | "not-configured" | "invalid" | "storage-error";
      message?: string;
    };

const LOGIN_LIMITS = { bucket: "admin-login", max: 10, windowMs: 15 * 60 * 1000 };

/** Admin responses carry private data: never cache them anywhere. */
function noStore() {
  setResponseHeader("Cache-Control", "no-store, private");
  setResponseHeader("X-Robots-Tag", "noindex, nofollow");
}

// Live sessions: id → expiry (ms). A cookie only counts if its id is here, so
// signing out (or "sign out everywhere") ends a session for good.
const SESSIONS_KEY = "plush:admin:sessions";

async function signedIn(): Promise<boolean> {
  const cfg = adminConfig();
  const db = upstashConfig();
  if (!cfg || !db) return false;
  const session = await readSessionToken(getCookie(ADMIN_COOKIE), cfg);
  if (!session) return false;
  try {
    const [live] = await upstashPipeline(db, [["HEXISTS", SESSIONS_KEY, session.id]]);
    return Number(live) === 1;
  } catch {
    return false; // can't check: treat as signed out
  }
}

function missingConfig(): ("password" | "database")[] {
  const missing: ("password" | "database")[] = [];
  if (!adminConfig()) missing.push("password");
  if (!upstashConfig()) missing.push("database");
  return missing;
}

export const getAdminData = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminResult> => {
    noStore();
    const missing = missingConfig();
    if (missing.length > 0) return { status: "not-configured", missing };
    if (!(await signedIn())) return { status: "signed-out" };
    try {
      return { status: "ok", doc: await loadAdminDoc(upstashConfig()!) };
    } catch (error) {
      console.error(`admin: load failed (${String(error).slice(0, 300)})`);
      return { status: "storage-error" };
    }
  },
);

export const adminLogin = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ password: z.string().max(200) }).parse(data))
  .handler(async ({ data }): Promise<LoginResult> => {
    noStore();
    const cfg = adminConfig();
    const db = upstashConfig();
    if (!cfg || !db) return { ok: false, reason: "not-configured" };

    const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    if (await isRateLimited(ip, LOGIN_LIMITS)) return { ok: false, reason: "limited" };

    if (!(await passwordMatches(data.password, cfg))) {
      console.warn(JSON.stringify({ event: "admin-login-failed", at: new Date().toISOString() }));
      return { ok: false, reason: "wrong" };
    }

    const session = await createSession(cfg);
    const now = Date.now();
    const [existing] = await upstashPipeline(db, [["HGETALL", SESSIONS_KEY]]);
    const expired: string[] = [];
    if (Array.isArray(existing)) {
      for (let i = 0; i + 1 < existing.length; i += 2) {
        if (Number(existing[i + 1]) <= now) expired.push(String(existing[i]));
      }
    }
    await upstashPipeline(db, [
      ...(expired.length ? [["HDEL", SESSIONS_KEY, ...expired]] : []),
      ["HSET", SESSIONS_KEY, session.id, session.expires],
    ]);
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
    const cfg = adminConfig();
    const db = upstashConfig();
    if (cfg && db) {
      const session = await readSessionToken(getCookie(ADMIN_COOKIE), cfg);
      // Only a live session can end sessions, so a stranger can't sign the team out.
      if (session && (await signedIn())) {
        await upstashPipeline(db, [
          data.everywhere ? ["DEL", SESSIONS_KEY] : ["HDEL", SESSIONS_KEY, session.id],
        ]).catch(() => undefined);
      }
    }
    deleteCookie(ADMIN_COOKIE, { httpOnly: true, secure: true, sameSite: "strict", path: "/" });
    return { ok: true as const };
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

export const mutateAdminData = createServerFn({ method: "POST" })
  .validator((data: unknown) => mutationSchema.parse(data))
  .handler(async ({ data }): Promise<MutationResult> => {
    noStore();
    if (missingConfig().length > 0) return { ok: false, reason: "not-configured" };
    if (!(await signedIn())) return { ok: false, reason: "signed-out" };
    const db = upstashConfig()!;

    try {
      if (data.op === "save") {
        const parsed = collectionSchemas[data.collection].safeParse(data.value);
        if (!parsed.success) {
          return { ok: false, reason: "invalid", message: describe(parsed.error) };
        }
        await updateAdminDoc(db, (doc) => {
          const rows = doc[data.collection] as { id: string }[];
          if (data.id === null) {
            rows.push({ ...parsed.data, id: newId() });
          } else {
            const index = rows.findIndex((r) => r.id === data.id);
            if (index < 0) throw new AdminChangeError("Someone else deleted that row.");
            rows[index] = { ...parsed.data, id: data.id };
          }
          return doc;
        });
        return { ok: true };
      }

      if (data.op === "delete") {
        await updateAdminDoc(db, (doc) => {
          const rows = doc[data.collection] as { id: string }[];
          return { ...doc, [data.collection]: rows.filter((r) => r.id !== data.id) };
        });
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
          (parsed.data[c] as object[]).map((r) => ({ ...r, id: newId() })),
        ]),
      ) as Record<(typeof COLLECTIONS)[number], { id: string }[]>;
      const added = COLLECTIONS.reduce((n, c) => n + incoming[c].length, 0);
      if (added === 0) return { ok: false, reason: "invalid", message: "Nothing to import." };

      await updateAdminDoc(db, (doc) => {
        const next = { ...doc };
        for (const c of COLLECTIONS) {
          // Replace only swaps the lists the import actually contains.
          const keep = data.mode === "replace" && incoming[c].length > 0 ? [] : doc[c];
          (next as Record<string, unknown>)[c] = [...keep, ...incoming[c]];
        }
        return next;
      });
      return { ok: true, added };
    } catch (error) {
      if (error instanceof AdminChangeError) {
        return { ok: false, reason: "invalid", message: error.message };
      }
      console.error(`admin: save failed (${String(error).slice(0, 300)})`);
      return { ok: false, reason: "storage-error" };
    }
  });
