import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLink } from "@/lib/auth";
import { setUserCookie } from "@/lib/billing";
import { getPublicSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "O formulário de confirmação é inválido." }, { status: 400 });
  }
  const token = form.get("token");
  const suppliedToken = typeof token === "string" ? token : "";
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(suppliedToken)) {
    return NextResponse.redirect(new URL("/?account=invalid-link", getPublicSiteUrl(request.url)), 303);
  }
  try {
    const identity = await consumeMagicLink(suppliedToken);
    if (!identity) {
      return NextResponse.redirect(new URL("/?account=expired-link", getPublicSiteUrl(request.url)), 303);
    }
    const response = NextResponse.redirect(new URL("/?account=verified", getPublicSiteUrl(request.url)), 303);
    setUserCookie(response, identity.userId);
    return response;
  } catch (error) {
    console.error("Falha ao verificar link de acesso AKIRA.", error);
    return NextResponse.redirect(new URL("/?account=verification-error", getPublicSiteUrl(request.url)), 303);
  }
}
