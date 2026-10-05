import { Client } from "@gradio/client";

const SPACE_ID = process.env.HF_SPACE_ID || "akra35567/Akiragpu";
const HF_TOKEN = process.env.HF_TOKEN?.trim();

export type ChatMsg = { role: "user" | "assistant"; content: string };
export type ChatResult = { reply: string; provider: string };
export type ImageResult = { image: string; info: string };

type ChatPayload = {
  reply?: unknown;
  provider?: unknown;
};

type ImagePayload = {
  image?: unknown;
  info?: unknown;
};

type DescriptionPayload = {
  description?: unknown;
  error?: unknown;
};

let clientPromise: Promise<Client> | undefined;

function isHfToken(value: string): value is `hf_${string}` {
  return value.startsWith("hf_");
}

export async function spaceClient(): Promise<Client> {
  if (!clientPromise) {
    if (HF_TOKEN && !isHfToken(HF_TOKEN)) {
      throw new Error("HF_TOKEN inválido: os tokens da Hugging Face começam por «hf_».");
    }
    const options = HF_TOKEN ? { hf_token: HF_TOKEN as `hf_${string}` } : undefined;
    clientPromise = Client.connect(
      SPACE_ID,
      options,
    ).catch((error: unknown) => {
      clientPromise = undefined;
      throw error;
    });
  }
  return clientPromise;
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
  const client = await spaceClient();
  const result = await client.predict("/chat", [message, history.slice(-40)]);
  const output = objectOutput<ChatPayload>(result.data, "chat");
  const reply = typeof output.reply === "string" ? output.reply.trim() : "";
  const provider = typeof output.provider === "string" ? output.provider : "AKIRA";

  if (!reply || provider === "error") {
    throw new Error(reply || "A AKIRA não conseguiu responder agora.");
  }

  return { reply, provider };
}

export async function apiImage(prompt: string, style = "foto realista"): Promise<ImageResult> {
  const client = await spaceClient();
  const result = await client.predict("/generate_image", [prompt, style]);
  const output = objectOutput<ImagePayload>(result.data, "geração de imagem");
  const image = typeof output.image === "string" ? output.image : "";

  if (!image) {
    throw new Error(
      typeof output.info === "string" && output.info
        ? `A AKIRA não conseguiu gerar a imagem: ${output.info}`
        : "A AKIRA não devolveu uma imagem.",
    );
  }

  return {
    image,
    info: typeof output.info === "string" ? output.info : "Imagem criada",
  };
}

export async function apiDescribe(imageB64: string, prompt?: string): Promise<string> {
  const client = await spaceClient();
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
