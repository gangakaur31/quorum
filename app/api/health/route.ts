import { providerDiagnostics } from "@/lib/agents/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const diagnostics = providerDiagnostics();
  return Response.json(
    {
      selected: diagnostics.selected,
      ready: diagnostics.ready,
      configurationError: diagnostics.configurationError,
      fallbackPolicy: diagnostics.fallbackPolicy,
      providers: diagnostics.providers.map(({ provider, model, configured, status, requests, successes, failures, lastError, lastLatencyMs, measuredUsageResponses, usage, fallbacks }) => ({ provider, model, configured, status, requests, successes, failures, lastError, lastLatencyMs, measuredUsageResponses, usage, fallbacks })),
      checkedAt: new Date().toISOString(),
      note: "Configuration and process-local observations only. This endpoint does not call a paid AI API.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
