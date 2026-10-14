function normalizeIntentText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-PT");
}

export function extractWebSearchQuery(value: string): string | null {
  const normalized = normalizeIntentText(value);
  const command =
    /^\s*(?:(?:por favor|podes|poderias|consegues|vai|faz|faz-me|quero(?: que)?|me)\s+)*(?:pesquis\w*|procur\w*|busc\w*|investig\w*)\b/i;
  const nounCommand =
    /^\s*(?:(?:por favor|podes|poderias|quero|faz|faz-me)\s+)*(?:uma\s+)?pesquis\w*\b/i;
  const match = command.exec(normalized) || nounCommand.exec(normalized);
  if (!match) return null;

  let query = value.slice(match[0].length).trim();
  const modifiers =
    /^(?:(?:na|pela)\s+(?:web|internet)|web|internet|online|sobre|acerca\s+de|para\s+mim|pra\s+mim|por\s+favor)\s+/i;
  while (modifiers.test(normalizeIntentText(query))) {
    const modifierMatch = modifiers.exec(normalizeIntentText(query));
    if (!modifierMatch) break;
    query = query.slice(modifierMatch[0].length).trim();
  }
  return query || null;
}

export function isImageGenerationRequest(value: string): boolean {
  const text = normalizeIntentText(value).trim();
  const command =
    /^(?:(?:por favor|podes|poderias|consegues|quero(?: que)?|preciso(?: que| de)?|faz|faz-me|me)\s+)*(?:criar|cria|crias|cries|gerar|gera|geras|geres|desenhar|desenha|desenhas|desenhes|ilustrar|ilustra|ilustras|ilustres|produzir|produz|fazer|faz|faca)\b[\s\S]{0,80}\b(?:imagem|foto|ilustracao|desenho)\b/i;
  const nounRequest =
    /^(?:(?:quero|preciso de|faz-me)\s+)(?:uma?\s+)?(?:imagem|foto|ilustracao|desenho)\b/i;
  return command.test(text) || nounRequest.test(text);
}
