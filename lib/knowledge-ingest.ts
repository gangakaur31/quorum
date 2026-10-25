import "server-only";
import { textField } from "./evidence";
import { publicSourceUrl, ResearchError } from "./research";
import { contentVersion, KNOWLEDGE_CATALOG } from "./knowledge";
import { KNOWLEDGE_TASKS, type KnowledgeAnswer, type KnowledgeDocument, type KnowledgeRegion, type KnowledgeTask, type RetrievalSnapshot } from "./knowledge-types";
import type { SessionContext } from "./types";

export function importDocument(input: unknown, previous?: KnowledgeDocument, extracted?: { content: string; url: string }): KnowledgeDocument {
  const value = input as Record<string, unknown>;
  if (value?.consent !== true) throw new Error("Confirm you have permission to store this material and send relevant passages to the configured AI provider.");
  const content = extracted?.content ?? value.content;
  if (typeof content !== "string" || content.trim().length < 30 || content.length > 60000 || content.includes("\u0000")) throw new Error("Use 30–60,000 characters of readable text. For longer documents, import a relevant excerpt.");
  const tasks = value.tasks;
  if (!Array.isArray(tasks) || !tasks.length || tasks.length > KNOWLEDGE_TASKS.length || tasks.some(t => !KNOWLEDGE_TASKS.includes(t as KnowledgeTask) || t === "legal")) throw new Error("Choose supported features. Legal preparation uses curated authority references only.");
  const region = value.region as KnowledgeRegion;
  if (!["global", "india", "us", "eu", "uk", "other"].includes(region)) throw new Error("Choose a valid source jurisdiction or Global / not specific.");
  let publishedAt: string | null = null;
  if (value.publishedAt) {
    if (typeof value.publishedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.publishedAt) || Number.isNaN(Date.parse(value.publishedAt)) || new Date(value.publishedAt).toISOString().slice(0, 10) !== value.publishedAt || value.publishedAt > new Date().toISOString().slice(0, 10)) throw new Error("Use a valid publication date, or leave it unknown.");
    publishedAt = value.publishedAt;
  }
  const source = extracted?.url ?? (value.url ? publicSourceUrl(value.url) : "Private uploaded or pasted document");
  const limitations = textField(value.limitations, "Source limitations", 1000);
  const title = textField(value.title, "Source title", 200), publisher = textField(value.publisher, "Publisher / origin", 200);
  const provenance = extracted ? "tavily_extract" as const : "manual_import" as const;
  return { id: previous?.id ?? `document-${crypto.randomUUID()}`, title, publisher, content, source, layer: "project", provenance,
    tasks: [...new Set(tasks)] as KnowledgeTask[], regions: [region], publishedAt, reviewedAt: new Date().toISOString(), limitations,
    enabled: previous?.enabled ?? true, version: contentVersion(JSON.stringify([content, source, title, publisher, tasks, region, publishedAt, limitations, provenance])) };
}
export function upsertDocument(context: SessionContext, doc: KnowledgeDocument) {
  const documents = [...(context.knowledgeDocuments ?? []).filter(d => d.id !== doc.id), doc];
  if (documents.length > 12) throw new Error("This project supports twelve imported documents. Remove a source before adding another.");
  if (documents.some(d => d.id !== doc.id && (d.content.trim() === doc.content.trim() || (doc.source.startsWith("https:") && d.source === doc.source)))) throw new Error("This source is already imported. Update the existing document instead.");
  return documents;
}
export function catalogId(value: unknown) {
  if (typeof value !== "string" || !KNOWLEDGE_CATALOG.some(d => d.id === value)) throw new Error("Choose a curated source.");
  return value;
}
/** Our server contacts only Tavily's fixed endpoint, never an arbitrary supplied host. */
export async function extractDocument(rawUrl: unknown, signal?: AbortSignal) {
  const url = publicSourceUrl(rawUrl), key = process.env.TAVILY_API_KEY?.trim();
  if (!key) throw new ResearchError("Tavily is not configured. Paste or upload the source text instead.");
  let response: Response;
  try { response = await fetch("https://api.tavily.com/extract", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ urls: [url], extract_depth: "basic", format: "markdown", include_images: false }), signal: AbortSignal.any([AbortSignal.timeout(20000), ...(signal ? [signal] : [])]) }); }
  catch { throw new ResearchError(signal?.aborted ? "Source import cancelled." : "Source extraction timed out or could not connect. Existing sources are unchanged.", 502); }
  if (!response.ok) throw new ResearchError(`Tavily extraction returned HTTP ${response.status}. Check the key, credits and source accessibility.`, 502);
  // Bound the upstream body too; no unbounded JSON/text allocation on the write path.
  const reader = response.body?.getReader(); let body = "", bytes = 0; const decoder = new TextDecoder();
  if (!reader) throw new ResearchError("Extraction returned no content.", 502);
  try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 1000000) { await reader.cancel(); throw new ResearchError("This page is too large. Import a relevant excerpt manually."); } body += decoder.decode(part.value, { stream: true }); } body += decoder.decode(); } finally { reader.releaseLock(); }
  let data: { results?: Array<{ url?: string; raw_content?: unknown }> };
  try { data = JSON.parse(body); } catch { throw new ResearchError("Extraction returned an invalid response.", 502); }
  if (!data || !Array.isArray(data.results)) throw new ResearchError("Extraction returned an invalid response.", 502);
  const result = data.results.find(r => r?.url === url);
  if (!result || typeof result.raw_content !== "string" || result.raw_content.trim().length < 30) throw new ResearchError("Tavily could not extract readable text from this URL. Paste an authorised excerpt instead.", 502);
  if (result.raw_content.length > 60000) throw new ResearchError("This page exceeds the document limit. Paste a relevant excerpt of up to 60,000 characters instead.");
  return { url, content: result.raw_content };
}
export function validateKnowledgeAnswer(value: unknown, snapshot: RetrievalSnapshot): KnowledgeAnswer {
  const answer = value as KnowledgeAnswer;
  if (!Array.isArray(answer?.claims) || answer.claims.length > 6 || !Array.isArray(answer.gaps) || answer.gaps.length > 6) throw new Error("Expected bounded claims, citations and gaps.");
  const claims = answer.claims.map(claim => {
    if (!Array.isArray(claim?.citations) || !claim.citations.length || claim.citations.length > 3) throw new Error("Every answer claim needs supplied passage citations.");
    return { text: textField(claim.text, "Answer claim", 1200), citations: claim.citations.map(c => {
      const quoteId = (c as unknown as { quoteId?: unknown })?.quoteId;
      if (quoteId !== undefined) {
        const option = knowledgeQuoteOptions(snapshot).find(q => q.quoteId === quoteId);
        if (!option) throw new Error("Answer citations must select a supplied quote identifier.");
        return { passageId: option.passageId, quote: option.quote };
      }
      const passage = snapshot.passages.find(p => p.passageId === c?.passageId);
      if (!passage || typeof c.quote !== "string" || c.quote.trim().length < 10 || c.quote.length > 400) throw new Error("Answer citations must contain exact quotations from retrieved passages.");
      const quote = sourceQuote(passage.content, c.quote);
      if (!quote) throw new Error("Answer citations must contain exact quotations from retrieved passages.");
      return { passageId: passage.passageId, quote };
    }) };
  });
  const gaps = answer.gaps.map(g => textField(g, "Answer gap", 1000));
  if (!claims.length && !gaps.length) throw new Error("An unsupported answer must explain what is missing.");
  return { claims, gaps };
}

/** Let the model select source excerpts by ID instead of retyping Markdown or
 * JSON. The server supplies every displayed quote from the original passage. */
export function knowledgeQuoteOptions(snapshot: RetrievalSnapshot) {
  return snapshot.passages.flatMap((passage, p) => {
    const quotes: string[] = [];
    for (const line of passage.content.split(/\n+/u)) {
      for (let start = 0; start < line.length;) {
        let end = Math.min(start + 350, line.length);
        if (end < line.length) { const space = line.lastIndexOf(" ", end); if (space > start + 100) end = space; }
        const quote = line.slice(start, end).trim();
        if (quote.length >= 10 && !quotes.includes(quote)) quotes.push(quote);
        start = end;
      }
    }
    return quotes.slice(0, 16).map((quote, q) => ({ quoteId: `s${p + 1}q${q + 1}`, passageId: passage.passageId, quote }));
  });
}

/** Recover the original whitespace after a model reformats a quote. No word,
 * punctuation, case, Markdown or semantic approximation is accepted. */
function sourceQuote(source: string, quote: string): string | null {
  if (source.includes(quote)) return quote;
  const starts: number[] = [], ends: number[] = []; let normalized = "";
  for (const match of source.matchAll(/\s+|\S+/gu)) {
    if (/^\s/u.test(match[0])) { normalized += " "; starts.push(match.index); ends.push(match.index + match[0].length); }
    else for (let i = 0; i < match[0].length; i++) { normalized += match[0][i]; starts.push(match.index + i); ends.push(match.index + i + 1); }
  }
  const expected = quote.trim().replace(/\s+/gu, " "), offset = normalized.indexOf(expected);
  if (offset < 0) return null;
  const original = source.slice(starts[offset], ends[offset + expected.length - 1]);
  return original.length <= 1000 ? original : null;
}
