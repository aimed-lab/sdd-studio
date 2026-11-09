import { NextRequest, NextResponse } from "next/server";
import { ELEVATED_LOCK_MESSAGE, isElevatedRole } from "@/lib/elevated-roles";
import { INVITE_QUOTAS } from "@/lib/invitations";
import { type AppRole, hasRole } from "@/lib/roles";
import { authorize, rankOf } from "@/lib/session";

export const dynamic = "force-dynamic";

const forbidden = (msg: string) => NextResponse.json({ ok: false, error: msg }, { status: 403 });
import {
  getAllInvitations, getInvitationsByCreator, getInvitationByToken,
  createInvitation, redeemInvitation, revokeInvitation,
  countPendingInvitations,
} from "@/lib/db";

/**
 * /api/invitations — Server-side invitation management backed by Vercel Postgres.
 *
 * GET    — list invitations (all for admin, own for regular users)
 * POST   — create a new invitation
 * PUT    — redeem an invitation (token → accepted)
 * DELETE — revoke a pending invitation
 */

const VALID_ROLES = ["Owner", "Admin", "TechSupport", "Developer", "User"];

function sanitize(str: unknown, maxLen = 200): string {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, maxLen);
}

// ── GET — list invitations ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.response;
  const caller = auth.user;

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope"); // "all" for admin view
  if (caller && scope === "all" && !hasRole(caller.role, "Admin")) return forbidden("Admins only.");
  const email = caller ? caller.email : sanitize(searchParams.get("email"), 254).toLowerCase();

  try {
    const invitations = scope === "all"
      ? await getAllInvitations()
      : email
        ? await getInvitationsByCreator(email)
        : [];
    return NextResponse.json({ invitations });
  } catch (err) {
    console.error("[/api/invitations] GET error:", err);
    return NextResponse.json({ invitations: [], error: "Database unavailable" }, { status: 503 });
  }
}

// ── POST — create a new invitation ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const auth = await authorize(req);
  if (!auth.ok) return auth.response;
  const caller = auth.user;

  const id = sanitize(body.id, 30);
  const token = sanitize(body.token, 10).toUpperCase();
  const createdBy = caller ? caller.email : sanitize(body.createdBy, 254).toLowerCase();
  const assignedRole = sanitize(body.assignedRole, 20);
  const recipientHint = sanitize(body.recipientHint, 200) || null;
  const autoApprove = body.autoApprove === true;
  const expiresAt = sanitize(body.expiresAt, 30);

  if (!id || !token || !createdBy || !assignedRole || !expiresAt) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(assignedRole)) {
    return NextResponse.json({ ok: false, error: "Invalid role" }, { status: 400 });
  }
  if (caller) {
    if (assignedRole === "Owner" || rankOf(assignedRole) < rankOf(caller.role)) {
      return forbidden("You cannot invite someone to a role above your own.");
    }
    const quota = INVITE_QUOTAS[caller.role as AppRole] ?? 0;
    if ((await countPendingInvitations(caller.email)) >= quota) {
      return forbidden(`Invite limit reached (${quota} pending). Revoke one or wait for expiry.`);
    }
  } else if (isElevatedRole(assignedRole)) {
    return NextResponse.json({ ok: false, error: ELEVATED_LOCK_MESSAGE }, { status: 403 });
  }

  try {
    const invitation = await createInvitation({
      id,
      token,
      created_by: createdBy,
      assigned_role: assignedRole,
      recipient_hint: recipientHint,
      auto_approve: autoApprove,
      status: "pending",
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, invitation });
  } catch (err) {
    console.error("[/api/invitations] POST error:", err);
    return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
  }
}

// ── PUT — redeem / validate a token ─────────────────────────────────────────

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const action = sanitize(body.action, 20);

  // Action: "validate" — check if a token is valid without redeeming
  if (action === "validate") {
    const token = sanitize(body.token, 10).toUpperCase();
    if (!token) return NextResponse.json({ ok: false, error: "Token required" }, { status: 400 });

    try {
      const inv = await getInvitationByToken(token);
      if (!inv) return NextResponse.json({ ok: false, valid: false, error: "Token not found" });
      if (inv.status !== "pending") return NextResponse.json({ ok: false, valid: false, error: `Token already ${inv.status}` });
      if (new Date(inv.expires_at) < new Date()) return NextResponse.json({ ok: false, valid: false, error: "Token expired" });
      return NextResponse.json({
        ok: true, valid: true,
        assignedRole: inv.assigned_role,
        autoApprove: inv.auto_approve,
        createdBy: inv.created_by,
      });
    } catch (err) {
      console.error("[/api/invitations] validate error:", err);
      return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
    }
  }

  // Action: "redeem" — accept a token (with SSO on, joining goes through /api/join only)
  if (action === "redeem") {
    const auth = await authorize(req, "Owner");
    if (!auth.ok) return auth.response;
    const token = sanitize(body.token, 10).toUpperCase();
    const acceptedBy = sanitize(body.acceptedBy, 254).toLowerCase();
    if (!token || !acceptedBy) {
      return NextResponse.json({ ok: false, error: "Token and acceptedBy required" }, { status: 400 });
    }

    try {
      const inv = await redeemInvitation(token, acceptedBy);
      if (!inv) return NextResponse.json({ ok: false, error: "Token not found or already used" });
      return NextResponse.json({ ok: true, invitation: inv });
    } catch (err) {
      console.error("[/api/invitations] redeem error:", err);
      return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}

// ── DELETE — revoke a pending invitation ────────────────────────────────────

export async function DELETE(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const id = sanitize(body.id, 30);
  if (!id) {
    return NextResponse.json({ ok: false, error: "Invitation id required" }, { status: 400 });
  }

  const auth = await authorize(req);
  if (!auth.ok) return auth.response;
  const caller = auth.user;

  try {
    if (caller && !hasRole(caller.role, "Admin")) {
      const mine = await getInvitationsByCreator(caller.email);
      if (!mine.some((inv) => inv.id === id)) return forbidden("You can only revoke your own invitations.");
    }
    const ok = await revokeInvitation(id);
    return NextResponse.json({ ok });
  } catch (err) {
    console.error("[/api/invitations] DELETE error:", err);
    return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
  }
}
