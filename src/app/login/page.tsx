"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { importInvitationFromParams } from "@/lib/invitations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SSO_ERRORS: Record<string, string> = {
  denied: "Sign-in was cancelled.",
  expired: "Your sign-in took too long or was started in another tab. Please try again.",
  failed: "We could not complete sign-in. Please try again.",
  unavailable: "The SDD sign-in service is unavailable right now. Please try again shortly.",
  unverified_email: "Your SDD account email is not verified yet. Verify it, then sign in again.",
  account_rejected: "Your access request was not approved. Contact your administrator.",
  account_suspended: "Your account has been suspended. Contact your administrator.",
};

const PENDING_INVITE_KEY = "sdd-pending-invite";

export default function LoginPage() {
  const { login, ssoMode, pendingInvite, joinWithInvite } = useAuth();
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEmailInvite, setIsEmailInvite] = useState(false);

  // Pre-fill invite code from URL ?invite=TOKEN and import invitation data
  let searchParams: ReturnType<typeof useSearchParams> | null = null;
  try { searchParams = useSearchParams(); } catch { /* noop — rendered outside Suspense */ }
  useEffect(() => {
    if (!searchParams) return;
    const token = searchParams.get("invite");
    if (token) {
      setInviteCode(token);
      // If this is an email invitation, hide the code field entirely
      if (searchParams.get("type") === "email") {
        setIsEmailInvite(true);
      }
      // Import the invitation payload from URL params into this browser's localStorage
      // so validateToken() can find it (invitations are per-browser in localStorage)
      importInvitationFromParams(searchParams);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!searchParams) return;
    const code = searchParams.get("invite");
    try {
      if (code) sessionStorage.setItem(PENDING_INVITE_KEY, code);
      else if (pendingInvite) setInviteCode(sessionStorage.getItem(PENDING_INVITE_KEY) ?? "");
    } catch { /* storage unavailable */ }
    const ssoError = searchParams.get("sso_error");
    if (ssoError) setError(SSO_ERRORS[ssoError] ?? SSO_ERRORS.failed);
  }, [searchParams, pendingInvite]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) { setError("Enter your invitation code."); return; }
    setError("");
    setLoading(true);
    const err = await joinWithInvite(inviteCode);
    if (err) { setError(err); setLoading(false); }
    else { try { sessionStorage.removeItem(PENDING_INVITE_KEY); } catch { /* storage unavailable */ } }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const err = await login(email, inviteCode);
      if (err) setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50">
      <div className="w-full max-w-md px-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <span className="text-primary-foreground text-2xl font-bold">SD</span>
          </div>
          <h1 className="text-3xl font-bold">SmartDrugDiscovery</h1>
          <p className="text-muted-foreground mt-1 text-sm uppercase tracking-widest">faster &middot; cheaper &middot; personalized</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>{ssoMode ? (pendingInvite ? "Finish joining" : "Sign In") : isEmailInvite ? "Accept Invitation" : "Sign In"}</CardTitle>
            <CardDescription>
              {ssoMode
                ? "Sign in with your Smart Drug Discovery (SDD) account."
                : isEmailInvite
                ? "You\u2019ve been invited to join the platform. Enter your email to confirm."
                : "Enter your email to access the platform. New users need an invitation code."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ssoMode ? (
              pendingInvite ? (
                <form onSubmit={handleJoin} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Signed in as <span className="font-medium text-foreground">{pendingInvite}</span>. Enter your
                    invitation code once to join this platform.
                  </p>
                  <input
                    aria-label="Invitation code"
                    value={inviteCode}
                    onChange={(e) => { setInviteCode(e.target.value); setError(""); }}
                    placeholder="e.g. ABCD1234"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-md px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70 transition-colors"
                  >
                    {loading ? "Joining..." : "Join"}
                  </button>
                  <a href="/auth/logout" className="block text-center text-xs text-muted-foreground hover:underline">
                    Use a different SDD account
                  </a>
                </form>
              ) : (
                <div className="space-y-4">
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <button
                    type="button"
                    onClick={() => { setLoading(true); login("", ""); }}
                    disabled={loading}
                    className="w-full rounded-md px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70 transition-colors"
                  >
                    {loading ? "Redirecting..." : "Sign in with your SDD account"}
                  </button>
                  <p className="text-xs text-muted-foreground text-center">
                    One Smart Drug Discovery account for all lab apps. New here? You&apos;ll be asked for your
                    invitation code once after signing in.
                  </p>
                </div>
              )
            ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@institution.edu"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>
              {!isEmailInvite && (
                <div>
                  <label className="text-sm font-medium" htmlFor="invite-code">
                    Invitation Code
                  </label>
                  <input
                    id="invite-code"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="e.g. ABCD1234"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Returning users can sign in without a code.
                    Need an invitation? Ask a team member for an invite link.
                  </p>
                </div>
              )}
              {isEmailInvite && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    This is a direct invitation — no code needed. Just confirm your email above and click the button below.
                  </p>
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70 transition-colors"
              >
                {loading ? "Signing in..." : isEmailInvite ? "Accept & Join" : "Sign In"}
              </button>
            </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          AIDD 2.0 — Multi-scale, Parallel, Evidence-driven Drug Discovery
        </p>
      </div>
    </div>
  );
}
