import { readBody, apiError } from "@/lib/api";
import { addContact, addVisit } from "@/lib/live";
import { updateLiveDocument } from "@/lib/context-store";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    if (/bot|crawler|spider|headless/i.test(request.headers.get("user-agent") ?? "")) throw new Error("Automated submissions are not accepted.");
    const body = await readBody(request);
    let visitId: string | undefined;
    await updateLiveDocument((await params).publicId, document => {
      if (!document) throw new Error("This experiment is unavailable.");
      if (body.operation === "visit" && body.measurementConsent === true) { const result = addVisit(document, body.visitorId, body.source); visitId = result.visitId; return result.document; }
      if (body.operation === "contact") return addContact(document, body);
      throw new Error("Explicit measurement or contact consent is required.");
    });
    return Response.json({ accepted: true, visitId });
  } catch (error) { return apiError(error); }
}
