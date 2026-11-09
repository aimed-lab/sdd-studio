import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ISSUER, clientId, clientSecret, redirectUri } from "./config";

interface ProviderMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
}

let metadata: Promise<ProviderMetadata> | null = null;
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export function providerMetadata(): Promise<ProviderMetadata> {
  if (!metadata) {
    metadata = fetch(`${ISSUER}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(8000) })
      .then(async (res) => {
        if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
        const meta = (await res.json()) as ProviderMetadata;
        if (meta.issuer !== ISSUER) throw new Error("OIDC discovery returned a different issuer");
        return meta;
      })
      .catch((err) => {
        metadata = null;
        throw err;
      });
  }
  return metadata;
}

const random = () => randomBytes(32).toString("base64url");

export function newLoginFlow() {
  const verifier = random();
  return {
    state: random(),
    nonce: random(),
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
  };
}

export async function authorizationUrl(flow: { state: string; nonce: string; challenge: string }): Promise<string> {
  const meta = await providerMetadata();
  const url = new URL(meta.authorization_endpoint);
  url.search = new URLSearchParams({
    client_id: clientId(),
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: redirectUri(),
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: flow.challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

export interface VerifiedIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export async function exchangeCodeForIdentity(code: string, verifier: string, nonce: string): Promise<VerifiedIdentity> {
  const meta = await providerMetadata();
  const res = await fetch(meta.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
      client_id: clientId(),
      client_secret: clientSecret(),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error("Token response had no id_token");

  if (!jwks) jwks = createRemoteJWKSet(new URL(meta.jwks_uri));
  const { payload } = await jwtVerify(tokens.id_token, jwks, {
    issuer: ISSUER,
    audience: clientId(),
    // Asymmetric only, so a token signed with a shared secret can never be accepted.
    algorithms: ["RS256", "ES256", "PS256"],
  });
  if (payload.nonce !== nonce) throw new Error("ID token nonce mismatch");

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!payload.sub || !email) throw new Error("ID token is missing sub or email");

  return {
    sub: payload.sub,
    email,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : email.split("@")[0],
  };
}

export async function logoutUrl(postLogoutRedirect: string): Promise<string | null> {
  try {
    const meta = await providerMetadata();
    if (!meta.end_session_endpoint) return null;
    const url = new URL(meta.end_session_endpoint);
    url.search = new URLSearchParams({ client_id: clientId(), post_logout_redirect_uri: postLogoutRedirect }).toString();
    return url.toString();
  } catch {
    return null;
  }
}
