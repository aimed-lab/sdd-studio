export const ISSUER = process.env.OIDC_ISSUER || "https://auth.smartdrugdiscovery.org/realms/sdd";

const env = (key: string) => process.env[key] || "";

export const clientId = () => env("OIDC_CLIENT_ID");
export const clientSecret = () => env("OIDC_CLIENT_SECRET");
export const sessionSecret = () => env("SESSION_SECRET");

// SSO stays completely off until all three are set; a half-configured login is worse than none.
export const ssoEnabled = () => !!clientId() && !!clientSecret() && !!sessionSecret();

export function missingSsoConfig(): string[] {
  return (
    [
      ["OIDC_CLIENT_ID", clientId()],
      ["OIDC_CLIENT_SECRET", clientSecret()],
      ["SESSION_SECRET", sessionSecret()],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

export const baseUrl = () => (env("OIDC_BASE_URL") || "http://localhost:3000").replace(/\/+$/, "");
export const redirectUri = () => `${baseUrl()}/auth/callback`;
export const secureCookies = () => baseUrl().startsWith("https://");

/** Only a same-origin path is honoured as a post-login destination, never a full URL. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  return next.slice(0, 500);
}
