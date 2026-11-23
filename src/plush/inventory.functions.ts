import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, getRequestIP, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  adminConfig,
  createSessionToken,
  isValidSessionToken,
  passwordMatches,
} from "./admin-auth";
import { isRateLimited } from "./rate-limit";

// The inventory itself is NOT in this repo (the repo is public). It lives in
// the Vercel environment variable INVENTORY_JSON (Production), shaped like
// `inventorySchema` below, and is only ever sent to a signed-in browser.

const money = z.number().finite();

const inventorySchema = z.object({
  updated: z.string().max(40),
  items: z
    .array(
      z.object({
        item: z.string().max(300),
        cost: money,
        quantity: z.number().finite(),
        total: money,
        supplier: z.string().max(120),
        currency: z.enum(["CAD", "USD"]),
        note: z.string().max(300).optional(),
      }),
    )
    .max(2000),
  orders: z
    .array(
      z.object({
        supplier: z.string().max(120),
        orderNumber: z.string().max(80).nullable(),
        date: z.string().max(40).nullable(),
        currency: z.enum(["CAD", "USD"]),
        subtotal: money,
        shipping: money.nullable(),
        tax: money.nullable(),
        otherFees: money.nullable(),
        total: money,
        notes: z.string().max(400).optional(),
      }),
    )
    .max(500),
});

export type Inventory = z.infer<typeof inventorySchema>;

export type InventoryResult =
  | { status: "ok"; inventory: Inventory }
  | { status: "signed-out" }
  | { status: "not-configured" }
  | { status: "data-error" };

export type LoginResult =
  { ok: true } | { ok: false; reason: "wrong" | "limited" | "not-configured" };

const LOGIN_LIMITS = { bucket: "admin-login", max: 10, windowMs: 15 * 60 * 1000 };

export const getInventory = createServerFn({ method: "GET" }).handler(
  async (): Promise<InventoryResult> => {
    const cfg = adminConfig();
    if (!cfg) return { status: "not-configured" };
    if (!(await isValidSessionToken(getCookie(ADMIN_COOKIE), cfg))) {
      return { status: "signed-out" };
    }

    const raw = (process.env.INVENTORY_JSON ?? "").trim();
    if (!raw) return { status: "data-error" };
    try {
      return { status: "ok", inventory: inventorySchema.parse(JSON.parse(raw)) };
    } catch (error) {
      console.error(`inventory: INVENTORY_JSON is invalid (${String(error).slice(0, 300)})`);
      return { status: "data-error" };
    }
  },
);

export const adminLogin = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ password: z.string().max(200) }).parse(data))
  .handler(async ({ data }): Promise<LoginResult> => {
    const cfg = adminConfig();
    if (!cfg) return { ok: false, reason: "not-configured" };

    const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    if (await isRateLimited(ip, LOGIN_LIMITS)) return { ok: false, reason: "limited" };

    if (!(await passwordMatches(data.password, cfg))) {
      console.warn(JSON.stringify({ event: "admin-login-failed", at: new Date().toISOString() }));
      return { ok: false, reason: "wrong" };
    }

    setCookie(ADMIN_COOKIE, await createSessionToken(cfg), {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: ADMIN_SESSION_SECONDS,
    });
    return { ok: true };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(ADMIN_COOKIE, { httpOnly: true, secure: true, sameSite: "strict", path: "/" });
  return { ok: true as const };
});
