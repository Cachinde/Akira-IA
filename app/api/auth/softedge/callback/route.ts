import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { signInWithProvider } from "@/lib/auth";
import { clearOAuthStateCookie, ssoSecret, validateOAuthState } from "@/lib/oauth";
import { getOrCreateUser, setUserCookie } from "@/lib/billing";
import { getPublicSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

function loginRedirect(request: NextRequest, status: "error" | "unavailable") {
  const response = NextResponse.redirect(new URL(`/login?auth=${status}`, getPublicSiteUrl(request.url)));
  clearOAuthStateCookie(response, "softedge");
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return loginRedirect(request, "error");
  }
  const stateValue = form.get("state");
  const ticketValue = form.get("ticket");
  const state = typeof stateValue === "string" ? stateValue : null;
  if (!validateOAuthState(request, "softedge", state)) return loginRedirect(request, "error");
  const ticket = typeof ticketValue === "string" ? ticketValue : "";
  if (!ticket || ticket.length > 5000) return loginRedirect(request, "error");

  try {
    const { payload } = await jwtVerify(ticket, ssoSecret(), {
      issuer: "https://softedge-corporation.up.railway.app",
      audience: getPublicSiteUrl(request.url),
    });
    const subject = typeof payload.sub === "string" ? payload.sub : "";
    const email = typeof payload.email === "string" ? payload.email : "";
    const displayName = typeof payload.name === "string" ? payload.name : "";
    const tokenId = typeof payload.jti === "string" ? payload.jti : "";
    if (!subject || !email || !displayName || !tokenId || payload.email_verified !== true) {
      return loginRedirect(request, "error");
    }

    const currentIdentity = getOrCreateUser(request);
    const identity = await signInWithProvider({
      provider: "softedge",
      subject,
      email,
      displayName,
      preferredUserId: currentIdentity.userId,
      tokenId,
      tokenExpiresAt: payload.exp,
    });
    const response = NextResponse.redirect(new URL("/?auth=success", getPublicSiteUrl(request.url)), 303);
    clearOAuthStateCookie(response, "softedge");
    setUserCookie(response, identity.userId);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    console.error("SoftEdge sign-in callback failed.", error);
    return loginRedirect(request, "error");
  }
}
