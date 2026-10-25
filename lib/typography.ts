/** Editorial punctuation for application copy and generated websites. */
export function withoutEmDashes(text: string): string {
  return text.replace(/\s*(?:\u2014|&mdash;|&#0*8212;|&#x0*2014;)\s*/gi, " - ");
}

/** Exact source fields remain unchanged so quotation validation stays meaningful. */
export function normalizeGeneratedCopy(value: unknown, key = ""): unknown {
  if (["quote", "excerpt", "transcript", "url", "source", "id", "sourceId", "passageId", "quoteId"].includes(key)) return value;
  if (typeof value === "string") return withoutEmDashes(value);
  if (Array.isArray(value)) return value.map(item => normalizeGeneratedCopy(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, normalizeGeneratedCopy(item, name)]));
  return value;
}
