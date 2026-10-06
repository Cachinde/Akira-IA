import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export type OAuthProvider = "google" | "softedge";

function stateSecret(): string {
  const secret = process.env.BILLING_COOKIE_SECRET;
  if (!secret || secret.length < 32) throw new Error("OAuth state signing secret is unavailable.");
  return secret;
}

function signature(provider: OAuthProvider, state: string, verifier: string): string {
  return createHmac("sha256", stateSecret()).update(`${provider}.${state}.${verifier}`).digest("base64url");
}

export function createOAuthState(provider: OAuthProvider): { state: string; verifier: string; cookieValue: string } {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  return { state, verifier, cookieValue: `${state}.${verifier}.${signature(provider, state, verifier)}` };
}

export function validateOAuthState(request: NextRequest, provider: OAuthProvider, state: string | null): boolean {
  if (!state || !/^[A-Za-z0-9_-]{40,50}$/.test(state)) return false;
  const cookieValue = request.cookies.get(`akira_oauth_${provider}`)?.value || "";
  const [cookieState, verifier, suppliedSignature, ...extra] = cookieValue.split(".");
  if (extra.length || cookieState !== state || !verifier || !suppliedSignature) return false;
  try {
    const expected = Buffer.from(signature(provider, state, verifier));
    const supplied = Buffer.from(suppliedSignature);
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  } catch {
    return false;
  }
}

export function getOAuthVerifier(request: NextRequest, provider: OAuthProvider, state: string): string | null {
  if (!validateOAuthState(request, provider, state)) return null;
  return request.cookies.get(`akira_oauth_${provider}`)?.value.split(".")[1] || null;
}

export function setOAuthStateCookie(
  response: NextResponse,
  provider: OAuthProvider,
  cookieValue: string,
): void {
  response.cookies.set(`akira_oauth_${provider}`, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: provider === "softedge" && process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 600,
  });
}

export function clearOAuthStateCookie(response: NextResponse, provider: OAuthProvider): void {
  response.cookies.set(`akira_oauth_${provider}`, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: provider === "softedge" && process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 0,
  });
}

export function ssoSecret(): Uint8Array {
  const secret = process.env.AKIRA_SSO_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("AKIRA SSO signing secret is unavailable.");
  }
  return new TextEncoder().encode(secret);
}
