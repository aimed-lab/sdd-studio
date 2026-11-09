import { NextRequest, NextResponse } from "next/server";
import { ELEVATED_LOCK_MESSAGE, isElevatedRole } from "@/lib/elevated-roles";
import {
  getAllUsers, getUserByEmail, upsertUser, updateUserFields,
} from "@/lib/db";
import { authorize, rankOf } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * /api/users — Persistent user registry backed by Vercel Postgres.
 *
 * GET  — returns all registered users
 * POST — register / upsert a user (called on login)
 * PUT  — update a user record (approve / reject / suspend / role change)
 */

const VALID_ROLES = ["Owner", "Admin", "TechSupport", "Developer", "User"];
const VALID_STATUSES = ["active", "pending_approval", "invited", "rejected", "suspended"];

// ── Validation helpers ──────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

const forbidden = (msg: string) => NextResponse.json({ ok: false, error: msg }, { status: 403 });

function sanitize(str: unknown, maxLen = 200): string {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, maxLen);
}

// ── GET — fetch all users ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await authorize(req, "Admin");
  if (!auth.ok) return auth.response;
  try {
    const dbUsers = await getAllUsers();
    // Map snake_case DB columns to camelCase for the client
    const users = dbUsers.map((u) => ({
      email: u.email,
      name: u.name,
      role: u.role,
      accountStatus: u.account_status,
      title: u.title,
      institution: u.institution,
      invitedBy: u.invited_by,
      invitedAt: u.invited_at,
      approvedBy: u.approved_by,
      approvedAt: u.approved_at,
      registeredAt: u.registered_at,
    }));
    return NextResponse.json({ users, source: "postgres" });
  } catch (err) {
    console.error("[/api/users] GET error:", err);
    return NextResponse.json(
      { users: [], source: "error", error: "Database unavailable" },
      { status: 503 },
    );
  }
}

// ── POST — register a new user ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const email = sanitize(body.email, 254).toLowerCase();
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
  }

  const role = sanitize(body.role, 20);
  if (role && !VALID_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: "Invalid role" }, { status: 400 });
  }

  const accountStatus = sanitize(body.accountStatus, 30);
  if (accountStatus && !VALID_STATUSES.includes(accountStatus)) {
    return NextResponse.json({ ok: false, error: "Invalid accountStatus" }, { status: 400 });
  }

  const auth = await authorize(req);
  if (!auth.ok) return auth.response;
  const caller = auth.user;

  try {
    const existing = await getUserByEmail(email);
    if (existing) {
      if (caller && caller.email !== existing.email) return forbidden("You can only update your own profile.");
      // Role and status of an existing account change only through PUT's checks.
      const user = await upsertUser({ email, name: sanitize(body.name, 100) || undefined });
      return NextResponse.json({ ok: true, user });
    }
    if (caller) {
      // Signed in: only placeholder accounts for people being invited, at or below the caller's role.
      const newRole = role || "User";
      if (newRole === "Owner" || rankOf(newRole) < rankOf(caller.role)) {
        return forbidden("You cannot invite someone to a role above your own.");
      }
      const user = await upsertUser({
        email,
        name: sanitize(body.name, 100) || email.split("@")[0],
        role: newRole,
        account_status: "invited",
        invited_by: caller.email,
        invited_at: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true, user });
    }
    if (isElevatedRole(role)) {
      return NextResponse.json({ ok: false, error: ELEVATED_LOCK_MESSAGE }, { status: 403 });
    }
    const user = await upsertUser({
      email,
      name: sanitize(body.name, 100) || email.split("@")[0],
      role: role || "User",
      account_status: accountStatus || "pending_approval",
      invited_by: sanitize(body.invitedBy, 254) || null,
      invited_at: sanitize(body.invitedAt, 30) || null,
      approved_by: sanitize(body.approvedBy, 254) || null,
      approved_at: sanitize(body.approvedAt, 30) || null,
      registered_at: sanitize(body.registeredAt, 30) || new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    console.error("[/api/users] POST error:", err);
    return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
  }
}

// ── PUT — update user fields (approve, reject, suspend, role change) ────────

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const email = sanitize(body.email, 254).toLowerCase();
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
  }

  const role = sanitize(body.role, 20);
  if (role && !VALID_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: "Invalid role" }, { status: 400 });
  }

  const accountStatus = sanitize(body.accountStatus, 30);
  if (accountStatus && !VALID_STATUSES.includes(accountStatus)) {
    return NextResponse.json({ ok: false, error: "Invalid accountStatus" }, { status: 400 });
  }

  const auth = await authorize(req, "Admin");
  if (!auth.ok) return auth.response;
  const caller = auth.user;

  try {
    // Check if user exists; if not, create them (handles edge case of
    // users who only exist in an admin's localStorage)
    const existing = await getUserByEmail(email);

    if (caller) {
      if (!existing) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
      const roleChange = !!role && role !== existing.role;
      const statusChange = !!accountStatus && accountStatus !== existing.account_status;
      if (existing.email === caller.email && (roleChange || statusChange)) {
        return forbidden("You cannot change your own role or status.");
      }
      if ((roleChange || statusChange) && caller.role !== "Owner" && rankOf(caller.role) >= rankOf(existing.role)) {
        return forbidden("You can only manage accounts below your own role.");
      }
      if (roleChange && (role === "Owner" || rankOf(role) < rankOf(caller.role))) {
        return forbidden("You cannot grant a role above your own. Owner changes use ownership transfer.");
      }
      const now = new Date().toISOString();
      const user = await updateUserFields(email, {
        ...(roleChange ? { role } : {}),
        ...(statusChange ? { account_status: accountStatus } : {}),
        ...(statusChange && accountStatus === "active" ? { approved_by: caller.email, approved_at: now } : {}),
        ...(body.name ? { name: sanitize(body.name, 100) } : {}),
      });
      return NextResponse.json({ ok: true, user });
    }

    if (!existing && isElevatedRole(role)) {
      return NextResponse.json({ ok: false, error: ELEVATED_LOCK_MESSAGE }, { status: 403 });
    }
    if (existing) {
      const roleChange = !!role && role !== existing.role;
      const statusChange = !!accountStatus && accountStatus !== existing.account_status;
      if (
        (roleChange && (isElevatedRole(role) || isElevatedRole(existing.role))) ||
        (statusChange && isElevatedRole(existing.role))
      ) {
        return NextResponse.json({ ok: false, error: ELEVATED_LOCK_MESSAGE }, { status: 403 });
      }
    }
    if (!existing) {
      const user = await upsertUser({
        email,
        name: sanitize(body.name, 100) || email.split("@")[0],
        role: role || "User",
        account_status: accountStatus || "active",
        approved_by: sanitize(body.approvedBy, 254) || null,
        approved_at: sanitize(body.approvedAt, 30) || null,
      });
      return NextResponse.json({ ok: true, user });
    }

    const user = await updateUserFields(email, {
      ...(role ? { role } : {}),
      ...(accountStatus ? { account_status: accountStatus } : {}),
      ...(body.approvedBy ? { approved_by: sanitize(body.approvedBy, 254) } : {}),
      ...(body.approvedAt ? { approved_at: sanitize(body.approvedAt, 30) } : {}),
      ...(body.name ? { name: sanitize(body.name, 100) } : {}),
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    console.error("[/api/users] PUT error:", err);
    return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
  }
}
