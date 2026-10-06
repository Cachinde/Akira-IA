import { NextRequest, NextResponse } from "next/server";
import { getPublicSiteUrl } from "@/lib/site-url";
import { createOAuthState, setOAuthStateCookie, ssoSecret } from "@/lib/oauth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const siteUrl = getPublicSiteUrl(request.url);
    ssoSecret();
    const softEdgeUrl = new URL(process.env.SOFTEDGE_SSO_URL || "https://softedge-corporation.up.railway.app");
    if (softEdgeUrl.protocol !== "https:") throw new Error("SoftEdge SSO must use HTTPS.");
    const { state, cookieValue } = createOAuthState("softedge");
    const start = new URL("/api/auth/akira", softEdgeUrl);
    start.searchParams.set("callback_uri", `${siteUrl}/api/auth/softedge/callback`);
    start.searchParams.set("state", state);

    const response = NextResponse.redirect(start);
    setOAuthStateCookie(response, "softedge", cookieValue);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Could not start SoftEdge sign-in.", error);
    return NextResponse.redirect(new URL("/login?auth=unavailable", getPublicSiteUrl(request.url)));
  }
}
