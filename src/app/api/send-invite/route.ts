import { NextRequest, NextResponse } from "next/server";
import { getInvitationByToken, type DBInvitation } from "@/lib/db";

/**
 * /api/send-invite — Send an invitation email via Resend.
 *
 * POST body: { to, inviteLink, inviterName }
 *
 * Only emails a link to this site for an existing, unused, unexpired invitation
 * addressed to `to`. The role shown comes from the invitation record.
 */

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const sentByIp = new Map<string, number[]>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (sentByIp.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  sentByIp.set(ip, recent);
  return false;
}

async function findInvitation(token: string): Promise<DBInvitation | null> {
  // The client records the invitation without awaiting, so allow it a moment to land.
  for (let attempt = 0; attempt < 4; attempt++) {
    const inv = await getInvitationByToken(token);
    if (inv) return inv;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const to = String(body.to ?? "").trim().toLowerCase().slice(0, 254);
  const rawLink = String(body.inviteLink ?? "").trim().slice(0, 1000);
  const inviterName = String(body.inviterName ?? "Your administrator").trim().slice(0, 80) || "Your administrator";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return fail("Valid email required", 400);

  let link: URL;
  try {
    link = new URL(rawLink);
  } catch {
    return fail("Invite link required", 400);
  }
  if (link.origin !== req.nextUrl.origin || link.pathname !== "/login") {
    return fail("Invite link must point to this site's sign-in page", 400);
  }
  const token = (link.searchParams.get("invite") ?? "").toUpperCase();
  if (!/^[A-Z0-9]{4,20}$/.test(token)) return fail("Invite link has no valid invitation code", 400);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return fail("Too many invitation emails. Try again later.", 429);

  let inv: DBInvitation | null;
  try {
    inv = await findInvitation(token);
  } catch (err) {
    console.error("[/api/send-invite] invitation lookup failed:", err);
    return fail("Could not verify the invitation. Please try again.", 503);
  }
  if (!inv) return fail("No matching invitation was found for this link.", 404);
  if (inv.status !== "pending") return fail(`This invitation has already been ${inv.status}.`, 409);
  if (new Date(inv.expires_at) < new Date()) return fail("This invitation has expired.", 410);
  if (inv.recipient_hint?.includes("@") && inv.recipient_hint.toLowerCase() !== to) {
    return fail("This invitation was created for a different email address.", 403);
  }

  const role = inv.assigned_role;
  const inviteLink = link.toString();

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "RESEND_API_KEY not configured. Add it in Vercel → Settings → Environment Variables." },
      { status: 503 },
    );
  }

  // Determine sender — use verified domain if available, else Resend sandbox
  const fromDomain = process.env.RESEND_FROM_DOMAIN; // e.g. "smartdrugdiscovery.org"
  const from = fromDomain
    ? `SmartDrugDiscovery <noreply@${fromDomain}>`
    : `SmartDrugDiscovery <onboarding@resend.dev>`;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject: `You're invited to join SmartDrugDiscovery`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px; background: #166534; color: white; font-weight: bold; font-size: 18px; line-height: 48px; text-align: center;">SD</div>
            <h1 style="margin: 16px 0 4px; font-size: 22px; color: #111;">SmartDrugDiscovery</h1>
            <p style="margin: 0; font-size: 12px; color: #888; letter-spacing: 2px; text-transform: uppercase;">faster &middot; cheaper &middot; personalized</p>
          </div>

          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <p style="margin: 0 0 12px; font-size: 15px; color: #333;">Hi,</p>
            <p style="margin: 0 0 12px; font-size: 15px; color: #333;"><strong>${escapeHtml(inviterName)}</strong> has invited you to join the SmartDrugDiscovery platform as a <strong>${escapeHtml(role)}</strong>.</p>
            <p style="margin: 0 0 20px; font-size: 15px; color: #333;">Click the button below to accept your invitation:</p>

            <div style="text-align: center; margin: 24px 0;">
              <a href="${escapeHtml(inviteLink)}" style="display: inline-block; background: #166534; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">Accept Invitation</a>
            </div>

            <p style="margin: 16px 0 0; font-size: 12px; color: #888;">Or copy this link: <a href="${escapeHtml(inviteLink)}" style="color: #166534; word-break: break-all;">${escapeHtml(inviteLink)}</a></p>
          </div>

          <p style="font-size: 12px; color: #aaa; text-align: center;">This invitation expires in 14 days.</p>
          <p style="font-size: 12px; color: #aaa; text-align: center;">AIDD 2.0 — Multi-scale, Parallel, Evidence-driven Drug Discovery</p>
        </div>
      `,
    });

    if (error) {
      console.error("[/api/send-invite] Resend error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/send-invite] Error:", err);
    return NextResponse.json({ ok: false, error: "Failed to send email" }, { status: 500 });
  }
}
