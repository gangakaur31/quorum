import { createHash } from "node:crypto";
import { idField, textField } from "./evidence";
import type { LiveDocument, LiveStats } from "./live-types";
export function liveHash(publicId: string, value: string) { return createHash("sha256").update(`${publicId}:${value}`).digest("hex"); }
export function cleanSource(value: unknown) { return typeof value === "string" ? value.replace(/[^a-zA-Z0-9_. -]/g, "").slice(0, 100) || "direct / unknown" : "direct / unknown"; }
export function addVisit(document: LiveDocument, visitorId: unknown, source: unknown): { document: LiveDocument; visitId: string } {
  if (!document.active) throw new Error("This experiment is closed.");
  const hash = liveHash(document.publicId, idField(visitorId));
  const date = new Date().toISOString();
  const previous = document.visits.find(v => v.visitorHash === hash && v.createdAt.slice(0, 10) === date.slice(0, 10));
  if (previous) return { document, visitId: previous.id };
  if (document.visits.length >= 5000) throw new Error("This small experiment has reached its measurement limit.");
  const visitId = crypto.randomUUID();
  return { document: { ...document, visits: [...document.visits, { id: visitId, visitorHash: hash, source: cleanSource(source), createdAt: date }] }, visitId };
}
export function addContact(document: LiveDocument, input: Record<string, unknown>): LiveDocument {
  if (!document.active) throw new Error("This experiment is closed.");
  if (input.website || input.consent !== true) throw new Error("Confirm the data-use consent before submitting.");
  if (typeof input.startedAt !== "number" || Date.now() - input.startedAt < 2000 || Date.now() - input.startedAt > 86400000) throw new Error("Please review the offer and consent text before submitting.");
  const email = textField(input.email, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  const emailHash = liveHash(document.publicId, email);
  if (document.leads.some(l => l.emailHash === emailHash)) return document;
  if (document.leads.length >= 1000) throw new Error("This small experiment has reached its response limit.");
  const visitId = typeof input.visitId === "string" && document.visits.some(v => v.id === input.visitId) ? input.visitId : undefined;
  return { ...document, leads: [...document.leads, { email, emailHash, visitId, createdAt: new Date().toISOString(), consent: document.disclosure, source: cleanSource(input.source) }] };
}
export function liveStats(document: LiveDocument): LiveStats {
  const sources: Record<string, number> = Object.create(null);
  document.visits.forEach(v => { sources[v.source] = (sources[v.source] ?? 0) + 1; });
  return { publicId: document.publicId, title: document.title, active: document.active, createdAt: document.createdAt, consentingVisits: document.visits.length, contacts: document.leads.length, matchedContacts: new Set(document.leads.filter(l => l.visitId).map(l => l.visitId)).size, sources, leads: document.leads.map(({ email, createdAt, source }) => ({ email, createdAt, source })) };
}
