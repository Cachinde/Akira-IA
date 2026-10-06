import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPublicSiteUrl } from "@/lib/site-url";
import { createOAuthState, setOAuthStateCookie } from "@/lib/oauth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error("Google sign-in is unavailable because its server credentials are missing.");
    return NextResponse.redirect(new URL("/login?auth=unavailable", getPublicSiteUrl(request.url)));
  }

  try {
    const { state, verifier, cookieValue } = createOAuthState("google");
    const callback = `${getPublicSiteUrl(request.url)}/api/auth/google/callback`;
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorization.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callback,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();

    const response = NextResponse.redirect(authorization);
    setOAuthStateCookie(response, "google", cookieValue);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Could not start Google sign-in.", error);
    return NextResponse.redirect(new URL("/login?auth=error", getPublicSiteUrl(request.url)));
  }
}
