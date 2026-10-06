import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { signInWithProvider } from "@/lib/auth";
import { clearOAuthStateCookie, getOAuthVerifier } from "@/lib/oauth";
import { getOrCreateUser, setUserCookie } from "@/lib/billing";
import { getPublicSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function loginRedirect(request: NextRequest, status: "error" | "unavailable") {
  const response = NextResponse.redirect(new URL(`/login?auth=${status}`, getPublicSiteUrl(request.url)));
  clearOAuthStateCookie(response, "google");
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const verifier = state ? getOAuthVerifier(request, "google", state) : null;
  if (!verifier) {
    return loginRedirect(request, "error");
  }

  const code = url.searchParams.get("code");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!code || !clientId || !clientSecret) return loginRedirect(request, "unavailable");

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${getPublicSiteUrl(request.url)}/api/auth/google/callback`,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const tokenResult: unknown = await tokenResponse.json();
    const idToken = tokenResult && typeof tokenResult === "object" && "id_token" in tokenResult &&
      typeof tokenResult.id_token === "string" ? tokenResult.id_token : null;
    if (!tokenResponse.ok || !idToken) return loginRedirect(request, "error");

    const { payload } = await jwtVerify(idToken, googleKeys, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: clientId,
    });
    const email = typeof payload.email === "string" ? payload.email : "";
    const subject = typeof payload.sub === "string" ? payload.sub : "";
    const displayName = typeof payload.name === "string" ? payload.name : email.split("@")[0];
    if (!email || !subject || payload.email_verified !== true) return loginRedirect(request, "error");

    const currentIdentity = getOrCreateUser(request);
    const identity = await signInWithProvider({
      provider: "google",
      subject,
      email,
      displayName,
      preferredUserId: currentIdentity.userId,
    });
    const response = NextResponse.redirect(new URL("/?auth=success", getPublicSiteUrl(request.url)));
    clearOAuthStateCookie(response, "google");
    setUserCookie(response, identity.userId);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    console.error("Google sign-in callback failed.", error);
    return loginRedirect(request, "error");
  }
}
