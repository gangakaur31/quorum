import { NextResponse } from "next/server";
import { authorizeContext, deleteContext, getContext, storageMode } from "@/lib/context-store";
import { apiError } from "@/lib/api";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const context = await getContext(sessionId);
    if (!context) return NextResponse.json({ error: "This project is unavailable or expired." }, { status: 404 });
    authorizeContext(context, request.headers.get("authorization")?.replace(/^Bearer /, ""));
    return NextResponse.json({ context, storage: storageMode() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error, 403); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) throw new Error("Cross-origin changes are not permitted.");
    await deleteContext((await params).sessionId, request.headers.get("authorization")?.replace(/^Bearer /, ""));
    return NextResponse.json({ deleted: true });
  } catch (error) { return apiError(error, 403); }
}
