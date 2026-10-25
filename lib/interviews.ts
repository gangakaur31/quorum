import { textField } from "./evidence";
export function validateInterviewSynthesis(value: unknown, transcript: string) {
  const v = value as { findings?: Array<{ quote: string; interpretation: string }> };
  if (!v || !Array.isArray(v.findings) || v.findings.length < 1 || v.findings.length > 6) throw new Error("Expected one to six traceable interview findings.");
  return v.findings.map(f => {
    const quote = textField(f.quote, "Source quote", 1200);
    // Exact substring requirement prevents quote rewriting or fabricated participants.
    if (!transcript.includes(quote)) throw new Error("A generated quote does not occur in the imported notes.");
    return { quote, interpretation: textField(f.interpretation, "Interpretation", 1600) };
  });
}
