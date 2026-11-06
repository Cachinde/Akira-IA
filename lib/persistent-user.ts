import { NextRequest, NextResponse } from "next/server";
import {
  billingPool,
  ensureBillingSchema,
  getOrCreateUser,
  historyScope,
  setUserCookie,
} from "@/lib/billing";

export async function getPersistentUser(request: NextRequest) {
  const identity = getOrCreateUser(request);
  await ensureBillingSchema();
  await billingPool().query(
    "INSERT INTO akira_billing_accounts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING",
    [identity.userId],
  );
  return identity;
}

export function attachPersistentUserCookie<T extends NextResponse>(
  response: T,
  identity: { userId: string; created: boolean },
): T {
  if (identity.created) setUserCookie(response, identity.userId);
  return response;
}

export function persistentScopeMatches(
  request: NextRequest,
  identity: { userId: string },
): boolean {
  return request.headers.get("x-akira-account-scope") === historyScope(identity.userId);
}
