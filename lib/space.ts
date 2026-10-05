import { Client } from "@gradio/client";

const CHAT_SPACE_ID = process.env.AKIRA_CHAT_SPACE_ID || "akra35567/AKIRA-SOFTEDGE";
const IMAGE_SPACE_ID = process.env.HF_SPACE_ID || "akra35567/Akiragpu";
const HF_TOKEN = process.env.HF_TOKEN?.trim();

export type ChatMsg = { role: "user" | "assistant"; content: string };
export type ChatResult = { reply: string; provider: string };
export type ImageResult = { image: string; info: string };

type ImagePayload = {
  image?: unknown;
  info?: unknown;
};

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

export async function apiImage(prompt: string, style = "foto realista"): Promise<ImageResult> {
  const client = await imageSpaceClient();
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
