import { Client } from "@gradio/client";

const CHAT_SPACE_ID = process.env.AKIRA_CHAT_SPACE_ID || "akra35567/AKIRA-SOFTEDGE";
const IMAGE_SPACE_ID = process.env.HF_SPACE_ID || CHAT_SPACE_ID;
const HF_TOKEN = process.env.HF_TOKEN?.trim();

export type ChatMsg = { role: "user" | "assistant"; content: string };
export type ChatResult = { reply: string; provider: string };
export type ImageResult = { image: string; info: string };

type ImagePayload = {
  image?: unknown;
  info?: unknown;
};

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function isImageDataUrl(value: string): boolean {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  return !!match && match[2].length >= 128;
}

function isAllowedImageUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("A Space devolveu um URL de imagem inválido.");
  }
  const spaceHost = `${IMAGE_SPACE_ID.replace("/", "-")}.hf.space`.toLowerCase();
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== spaceHost) {
    throw new Error("A Space devolveu uma imagem alojada num domínio não autorizado.");
  }
  return url;
}

async function downloadImageDataUrl(url: string): Promise<string> {
  let currentUrl = url;
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const response = await fetch(isAllowedImageUrl(currentUrl), {
      redirect: "manual",
      signal: AbortSignal.timeout(60_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirectCount === 3) {
        throw new Error("A Space redirecionou demasiadas vezes ao devolver a imagem.");
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    if (!response.ok) {
      throw new Error(`Não foi possível descarregar a imagem da Space (HTTP ${response.status}).`);
    }

    const mimeType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!mimeType || !["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
      throw new Error("A Space devolveu um ficheiro que não é PNG, JPEG ou WebP.");
    }
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      throw new Error("A imagem devolvida pela Space excede o limite de 12 MB.");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Não foi possível ler os dados da imagem devolvida pela Space.");
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_IMAGE_BYTES) {
          await reader.cancel();
          throw new Error("A imagem devolvida pela Space excede o limite de 12 MB.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    if (totalBytes < 96) throw new Error("A Space devolveu um ficheiro de imagem vazio ou incompleto.");

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    const dataUrl = `data:${mimeType};base64,${btoa(binary)}`;
    if (!isImageDataUrl(dataUrl)) throw new Error("A Space devolveu dados de imagem inválidos.");
    return dataUrl;
  }
  throw new Error("Não foi possível obter a imagem da Space.");
}

async function normalizeImageValue(value: unknown, depth = 0): Promise<string | null> {
  if (depth > 4) return null;
  if (typeof value === "string") {
    if (isImageDataUrl(value)) return value.replace(/^data:image\/jpg;/i, "data:image/jpeg;");
    if (/^https:\/\//i.test(value)) return downloadImageDataUrl(value);
    const base64 = value.replace(/\s/g, "");
    if (base64.length >= 128 && /^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
      return `data:image/png;base64,${base64}`;
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const image = await normalizeImageValue(item, depth + 1);
      if (image) return image;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;

  const imageObject = value as Record<string, unknown>;
  for (const key of ["image", "url", "data", "base64", "path"]) {
    if (key === "path" && typeof imageObject.path === "string" && imageObject.path.startsWith("/")) {
      const spaceHost = `${IMAGE_SPACE_ID.replace("/", "-")}.hf.space`.toLowerCase();
      const filePath = imageObject.path.startsWith("/gradio_api/file=")
        ? imageObject.path
        : `/gradio_api/file=${imageObject.path}`;
      const image = await downloadImageDataUrl(`https://${spaceHost}${filePath}`);
      if (image) return image;
      continue;
    }
    const image = await normalizeImageValue(imageObject[key], depth + 1);
    if (image) return image;
  }
  return null;
}

type DescriptionPayload = {
  description?: unknown;
  error?: unknown;
};

type GradioMessage = {
  role: "user" | "assistant";
  content: Array<{ type: "text"; text: string }>;
  metadata: null;
  options: null;
};

let chatClientPromise: Promise<Client> | undefined;
let imageClientPromise: Promise<Client> | undefined;

function isHfToken(value: string): value is `hf_${string}` {
  return value.startsWith("hf_");
}

function connectSpace(
  spaceId: string,
  clientPromise: Promise<Client> | undefined,
  setClient: (client: Promise<Client> | undefined) => void,
): Promise<Client> {
  if (!clientPromise) {
    if (HF_TOKEN && !isHfToken(HF_TOKEN)) {
      throw new Error("HF_TOKEN inválido: os tokens da Hugging Face começam por «hf_».");
    }
    const options = HF_TOKEN ? { hf_token: HF_TOKEN as `hf_${string}` } : undefined;
    clientPromise = Client.connect(spaceId, options).catch((error: unknown) => {
      setClient(undefined);
      throw error;
    });
    setClient(clientPromise);
  }
  return clientPromise;
}

export function chatSpaceClient(): Promise<Client> {
  return connectSpace(CHAT_SPACE_ID, chatClientPromise, (client) => { chatClientPromise = client; });
}

export function imageSpaceClient(): Promise<Client> {
  return connectSpace(IMAGE_SPACE_ID, imageClientPromise, (client) => { imageClientPromise = client; });
}

function unwrapOutput(data: unknown): unknown {
  return Array.isArray(data) && data.length === 1 ? data[0] : data;
}

function objectOutput<T>(data: unknown, name: string): T {
  const output = unwrapOutput(data);
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new Error(`A AKIRA devolveu uma resposta inválida para ${name}.`);
  }
  return output as T;
}

export async function apiChat(message: string, history: ChatMsg[]): Promise<ChatResult> {
  const client = await chatSpaceClient();
  const gradioHistory: GradioMessage[] = history.slice(-12).map(({ role, content }) => ({
    role,
    content: [{ type: "text", text: content }],
    metadata: null,
    options: null,
  }));
  const result = await client.predict("/_send", [message, gradioHistory, null]);
  const data: unknown = result.data;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("A AKIRA devolveu uma resposta de conversa inválida.");
  }
  const output: unknown = data[0];
  if (!Array.isArray(output)) {
    throw new Error("A AKIRA devolveu um histórico de conversa inválido.");
  }
  const lastAssistantMessage = [...output].reverse().find(
    (item) => item && typeof item === "object" && (item as Record<string, unknown>).role === "assistant",
  ) as Record<string, unknown> | undefined;
  const content = lastAssistantMessage?.content;
  const reply = (typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content
          .filter((part): part is { text: string } => !!part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string")
          .map((part) => part.text)
          .join("\n")
      : "").trim();

  if (!reply) {
    throw new Error("A AKIRA não devolveu uma resposta de texto.");
  }

  return { reply, provider: "AKIRA-SOFTEDGE" };
}

export async function apiImage(
  prompt: string,
  style = "foto realista",
  history: ChatMsg[] = [],
): Promise<ImageResult> {
  const client = await imageSpaceClient();
  const result = await client.predict("/generate_image", [prompt, style, JSON.stringify(history)]);
  const output = objectOutput<ImagePayload>(result.data, "geração de imagem");
  const image = await normalizeImageValue(output.image ?? output);

  if (!image) {
    const outputKeys = Object.keys(output).join(", ") || "nenhum";
    console.error("A resposta da Space não contém imagem reconhecível.", {
      outputKeys,
      imageType: typeof output.image,
    });
    throw new Error(
      typeof output.info === "string" && output.info
        ? `A AKIRA não conseguiu gerar a imagem: ${output.info}`
        : `A Space terminou a geração, mas não devolveu uma imagem reconhecível (campos: ${outputKeys}).`,
    );
  }

  return {
    image,
    info: typeof output.info === "string" ? output.info : "Imagem criada",
  };
}

export async function apiDescribe(imageB64: string, prompt?: string): Promise<string> {
  const client = await imageSpaceClient();
  const result = await client.predict("/describe_image", [
    imageB64,
    prompt || "Descreve esta imagem em detalhe.",
  ]);
  const output = objectOutput<DescriptionPayload>(result.data, "análise de imagem");
  const description = typeof output.description === "string" ? output.description.trim() : "";

  if (!description || output.error) {
    throw new Error(
      typeof output.error === "string" && output.error
        ? output.error
        : "A AKIRA não conseguiu analisar a imagem.",
    );
  }

  return description;
}
