/** Scripted fixtures must never be interpreted as collected customer validation. */
export function isDemoRecord(record: { demo?: boolean; summary?: string; source?: string; limitations?: string; transcript?: string; participant?: string; name?: string; method?: string }) {
  return record.demo === true || [record.summary, record.source, record.limitations, record.transcript, record.participant, record.name, record.method].some(value => typeof value === "string" && value.includes("[DEMO]"));
}
