export const CHAT_MESSAGE_CHARACTER_LIMIT = 8_000;
export const IMAGE_GENERATION_CHARACTER_LIMIT = 1_000;
export const CHAT_REQUEST_CHARACTER_LIMIT = 60_000;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
