import { NextRequest, NextResponse } from "next/server";
import { loadSharedMessage } from "@/lib/billing";

export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Props) {
  const { id } = await params;
  const shared = await loadSharedMessage(id);
  if (!shared?.image) {
    return NextResponse.json({ error: "Esta partilha não contém uma imagem." }, { status: 404 });
  }

  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(shared.image);
  if (!match || match[2].length > 17_000_000) {
    console.error("A imagem de uma partilha tem um formato inválido.", { shareId: id });
    return NextResponse.json({ error: "A imagem partilhada está inválida." }, { status: 502 });
  }

  const image = Buffer.from(match[2], "base64");
  if (!image.length || image.length > 12 * 1024 * 1024) {
    console.error("A imagem de uma partilha excede o limite de tamanho.", {
      shareId: id,
      imageBytes: image.length,
    });
    return NextResponse.json({ error: "A imagem partilhada excede 12 MB." }, { status: 502 });
  }

  const mimeType = match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase();
  return new NextResponse(new Uint8Array(image), {
    headers: {
      "Content-Type": `image/${mimeType}`,
      "Content-Length": String(image.length),
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
