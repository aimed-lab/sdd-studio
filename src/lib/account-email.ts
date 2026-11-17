// Moves a Studio account to a new email address, for example when a person's SDD sign-in
// (auth.smartdrugdiscovery.org) uses a different address from the one Studio knows them by.
// Studio matches the signed-in SDD account to its own account by email, so without this the
// person is treated as new and asked for an invitation code, and nobody can be invited as Owner.

import { db, sql } from "@vercel/postgres";
import "@/lib/db"; // sets POSTGRES_URL from whichever variable Vercel provided
import { ensureProjectsSchema } from "@/lib/projects-db";

export const ACCOUNT_EMAIL_RE = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/;

export interface AccountEmailChange {
  /** The account row itself (always 1 when the move succeeds). */
  account: number;
  /** Other accounts that record this person as their inviter or approver. */
  invitedBy: number;
  approvedBy: number;
  /** Invitations this person created or accepted. */
  invitationsCreated: number;
  invitationsAccepted: number;
  /** Sandbox push tokens this person owns. */
  pushTokens: number;
}

export type AccountEmailResult =
  | { ok: true; dryRun: boolean; role: string; status: string; changes: AccountEmailChange }
  | { ok: false; status: number; error: string };

class DryRun extends Error {}

/**
 * Renames `from` to `to` in one transaction: the account keeps its role, status and history.
 * Audit entries are left as they were. With dryRun, the same updates run and are rolled back,
 * so the counts are exact and nothing is written.
 */
export async function changeAccountEmail(fromRaw: string, toRaw: string, dryRun: boolean): Promise<AccountEmailResult> {
  const from = fromRaw.trim().toLowerCase();
  const to = toRaw.trim().toLowerCase();
  if (!ACCOUNT_EMAIL_RE.test(from) || !ACCOUNT_EMAIL_RE.test(to)) return { ok: false, status: 400, error: "from and to must be email addresses." };
  if (from === to) return { ok: false, status: 400, error: "from and to are the same address." };

  await ensureProjectsSchema(); // project_tokens must exist before it is updated
  const client = await db.connect();
  let result: AccountEmailResult | null = null;
  try {
    await client.sql`BEGIN`;
    await client.sql`SELECT pg_advisory_xact_lock(hashtext('account-email'))`;
    const current = await client.sql<{ role: string; account_status: string }>`
      SELECT role, account_status FROM users WHERE email = ${from} FOR UPDATE`;
    if (!current.rows.length) {
      result = { ok: false, status: 404, error: `No Studio account uses ${from}.` };
      throw new DryRun();
    }
    const taken = await client.sql`SELECT 1 FROM users WHERE email = ${to}`;
    if (taken.rows.length) {
      result = { ok: false, status: 409, error: `A Studio account already uses ${to}. Remove or rename it first.` };
      throw new DryRun();
    }
    const changes: AccountEmailChange = {
      account: (await client.sql`UPDATE users SET email = ${to}, updated_at = NOW() WHERE email = ${from}`).rowCount ?? 0,
      invitedBy: (await client.sql`UPDATE users SET invited_by = ${to} WHERE invited_by = ${from}`).rowCount ?? 0,
      approvedBy: (await client.sql`UPDATE users SET approved_by = ${to} WHERE approved_by = ${from}`).rowCount ?? 0,
      invitationsCreated: (await client.sql`UPDATE invitations SET created_by = ${to} WHERE created_by = ${from}`).rowCount ?? 0,
      invitationsAccepted: (await client.sql`UPDATE invitations SET accepted_by = ${to} WHERE accepted_by = ${from}`).rowCount ?? 0,
      pushTokens: (await client.sql`UPDATE project_tokens SET created_by = ${to} WHERE created_by = ${from}`).rowCount ?? 0,
    };
    result = { ok: true, dryRun, role: current.rows[0].role, status: current.rows[0].account_status, changes };
    if (dryRun) throw new DryRun();
    await client.sql`COMMIT`;
    return result;
  } catch (err) {
    await client.sql`ROLLBACK`.catch(() => undefined);
    if (err instanceof DryRun && result) return result;
    throw err;
  } finally {
    client.release();
  }
}

// ── Account list and first Owner (admin key) ────────────────────────────────

export interface AccountRow { email: string; name: string; role: string; account_status: string; registered_at: string }

/** All accounts, highest role first (at most 1,000), optionally one role only. */
export async function listAccounts(role: string | null): Promise<AccountRow[]> {
  const { rows } = role
    ? await sql<AccountRow>`
        SELECT email, name, role, account_status, registered_at FROM users WHERE role = ${role} ORDER BY email LIMIT 1000`
    : await sql<AccountRow>`
        SELECT email, name, role, account_status, registered_at FROM users
        ORDER BY CASE role WHEN 'Owner' THEN 0 WHEN 'Admin' THEN 1 WHEN 'TechSupport' THEN 2 WHEN 'Developer' THEN 3 ELSE 4 END, email
        LIMIT 1000`;
  return rows;
}

export type SetOwnerResult =
  | { ok: true; dryRun: boolean; action: "created" | "promoted"; previous: { role: string; status: string } | null }
  | { ok: false; status: number; error: string };

/**
 * Makes `email` the Owner, but only while Studio has no active Owner (first setup, or the Owner
 * existed only in a browser before single sign-on). It never replaces an existing Owner; that is
 * ownership transfer, done by the Owner in Studio.
 */
export async function setFirstOwner(emailRaw: string, dryRun: boolean): Promise<SetOwnerResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!ACCOUNT_EMAIL_RE.test(email)) return { ok: false, status: 400, error: "email must be an email address." };
  const client = await db.connect();
  let result: SetOwnerResult | null = null;
  try {
    await client.sql`BEGIN`;
    await client.sql`SELECT pg_advisory_xact_lock(hashtext('account-email'))`;
    const owners = await client.sql<{ email: string }>`
      SELECT email FROM users WHERE role = 'Owner' AND account_status = 'active'`;
    if (owners.rows.length) {
      result = { ok: false, status: 409, error: `Studio already has an Owner (${owners.rows.map((r) => r.email).join(", ")}). Use ownership transfer in Studio.` };
      throw new DryRun();
    }
    const existing = await client.sql<{ role: string; account_status: string }>`
      SELECT role, account_status FROM users WHERE email = ${email} FOR UPDATE`;
    const previous = existing.rows.length ? { role: existing.rows[0].role, status: existing.rows[0].account_status } : null;
    if (previous) {
      await client.sql`
        UPDATE users SET role = 'Owner', account_status = 'active', approved_by = 'admin-key', approved_at = NOW(), updated_at = NOW()
        WHERE email = ${email}`;
    } else {
      await client.sql`
        INSERT INTO users (email, name, role, account_status, approved_by, approved_at)
        VALUES (${email}, ${email.split("@")[0]}, 'Owner', 'active', 'admin-key', NOW())`;
    }
    result = { ok: true, dryRun, action: previous ? "promoted" : "created", previous };
    if (dryRun) throw new DryRun();
    await client.sql`COMMIT`;
    return result;
  } catch (err) {
    await client.sql`ROLLBACK`.catch(() => undefined);
    if (err instanceof DryRun && result) return result;
    throw err;
  } finally {
    client.release();
  }
}
