// Server-only: personal admin accounts, live sessions and the activity log, in
// the project's Upstash Redis. Roles are checked on the server for every call;
// the page only hides buttons as a convenience.
//
//   owner   everything, including managing accounts and "replace" imports
//   editor  add / edit / delete / import (append) records
//   viewer  read only; member contact emails are withheld from the server reply
//
// The built-in "owner" account (username `owner`, password ADMIN_PASSWORD) is
// not stored: it always exists, so the team can never lock itself out.
//
// Only import this from inside server-function handlers.

import { upstashPipeline, type UpstashConfig } from "./upstash";

export const ROLES = ["owner", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export type Account = {
  id: string;
  username: string;
  name: string;
  role: Role;
  hash: string;
  disabled: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  createdBy: string;
};

/** What the page is told about an account: never the hash. */
export type PublicAccount = Omit<Account, "hash">;

export const BUILTIN_OWNER: PublicAccount = {
  id: "owner",
  username: "owner",
  name: "Team owner (shared)",
  role: "owner",
  disabled: false,
  mustChangePassword: false,
  createdAt: "",
  createdBy: "",
};

const ACCOUNTS_KEY = "plush:admin:accounts"; // hash: account id → JSON
const SESSIONS_KEY = "plush:admin:sessions"; // hash: session id → JSON {accountId, expires}
export const ACTIVITY_KEY = "plush:admin:v1:activity"; // list, newest first
export const ACTIVITY_LENGTH = 1000;

export type ActivityEntry = {
  at: string;
  by: string;
  byId: string;
  action: string;
  detail: string;
};

export function activity(who: PublicAccount, action: string, detail: string): ActivityEntry {
  return { at: new Date().toISOString(), by: who.name, byId: who.id, action, detail };
}

export async function logActivity(db: UpstashConfig, entry: ActivityEntry): Promise<void> {
  await upstashPipeline(db, [
    ["LPUSH", ACTIVITY_KEY, JSON.stringify(entry)],
    ["LTRIM", ACTIVITY_KEY, 0, ACTIVITY_LENGTH - 1],
  ]).catch((error) => console.error(`admin: activity log failed (${String(error)})`));
}

export async function readActivity(db: UpstashConfig, count = 300): Promise<ActivityEntry[]> {
  const [raw] = await upstashPipeline(db, [["LRANGE", ACTIVITY_KEY, 0, count - 1]]);
  return (Array.isArray(raw) ? raw : []).flatMap((line) => {
    try {
      return [JSON.parse(String(line)) as ActivityEntry];
    } catch {
      return [];
    }
  });
}

// ---- Accounts --------------------------------------------------------------

export async function listAccounts(db: UpstashConfig): Promise<Account[]> {
  const [raw] = await upstashPipeline(db, [["HGETALL", ACCOUNTS_KEY]]);
  const out: Account[] = [];
  if (Array.isArray(raw)) {
    for (let i = 1; i < raw.length; i += 2) {
      try {
        out.push(JSON.parse(String(raw[i])) as Account);
      } catch {
        // skip a corrupt entry rather than break sign-in for everyone
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAccount(db: UpstashConfig, id: string): Promise<Account | null> {
  const [raw] = await upstashPipeline(db, [["HGET", ACCOUNTS_KEY, id]]);
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as Account;
  } catch {
    return null;
  }
}

export async function findByUsername(db: UpstashConfig, username: string): Promise<Account | null> {
  const wanted = username.trim().toLowerCase();
  return (await listAccounts(db)).find((a) => a.username === wanted) ?? null;
}

export async function putAccount(db: UpstashConfig, account: Account): Promise<void> {
  await upstashPipeline(db, [["HSET", ACCOUNTS_KEY, account.id, JSON.stringify(account)]]);
}

export async function removeAccount(db: UpstashConfig, id: string): Promise<void> {
  await upstashPipeline(db, [["HDEL", ACCOUNTS_KEY, id]]);
}

export function toPublic(account: Account): PublicAccount {
  const { hash, ...rest } = account;
  return rest;
}

// ---- Sessions --------------------------------------------------------------

type SessionRecord = { accountId: string; expires: number };

async function allSessions(db: UpstashConfig): Promise<[string, SessionRecord | null][]> {
  const [raw] = await upstashPipeline(db, [["HGETALL", SESSIONS_KEY]]);
  const out: [string, SessionRecord | null][] = [];
  if (Array.isArray(raw)) {
    for (let i = 0; i + 1 < raw.length; i += 2) {
      let record: SessionRecord | null = null;
      try {
        const parsed = JSON.parse(String(raw[i + 1])) as SessionRecord;
        if (typeof parsed?.accountId === "string") record = parsed;
      } catch {
        // older format or junk: treated as expired
      }
      out.push([String(raw[i]), record]);
    }
  }
  return out;
}

/** Records a new session, clearing out expired ones while it's there. */
export async function startSession(
  db: UpstashConfig,
  sessionId: string,
  accountId: string,
  expires: number,
): Promise<void> {
  const now = Date.now();
  const stale = (await allSessions(db)).filter(([, r]) => !r || r.expires <= now).map(([id]) => id);
  await upstashPipeline(db, [
    ...(stale.length ? [["HDEL", SESSIONS_KEY, ...stale]] : []),
    ["HSET", SESSIONS_KEY, sessionId, JSON.stringify({ accountId, expires })],
  ]);
}

export async function sessionAccountId(
  db: UpstashConfig,
  sessionId: string,
): Promise<string | null> {
  const [raw] = await upstashPipeline(db, [["HGET", SESSIONS_KEY, sessionId]]);
  if (typeof raw !== "string") return null;
  try {
    const record = JSON.parse(raw) as SessionRecord;
    return record.expires > Date.now() && typeof record.accountId === "string"
      ? record.accountId
      : null;
  } catch {
    return null;
  }
}

export async function endSession(db: UpstashConfig, sessionId: string): Promise<void> {
  await upstashPipeline(db, [["HDEL", SESSIONS_KEY, sessionId]]);
}

/** Ends every session for one account (all accounts if `accountId` is null). */
export async function endSessionsFor(
  db: UpstashConfig,
  accountId: string | null,
  keep?: string,
): Promise<void> {
  if (accountId === null) {
    await upstashPipeline(db, [["DEL", SESSIONS_KEY]]);
    return;
  }
  const ids = (await allSessions(db))
    .filter(([id, r]) => id !== keep && (!r || r.accountId === accountId))
    .map(([id]) => id);
  if (ids.length) await upstashPipeline(db, [["HDEL", SESSIONS_KEY, ...ids]]);
}
