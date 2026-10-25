// Explicit developer action: makes one small paid request to the configured provider.
require("./test-register.cjs");
require("@next/env").loadEnvConfig(process.cwd());
const { askJson, probeProviderJson, providerDiagnostics, normalizeProviderError } = require("../lib/agents/providers.ts");
(async () => {
  const requested = process.argv[2];
  if (requested) { if (!["gemini", "groq", "anthropic"].includes(requested)) throw new Error("Unsupported provider argument"); process.env.AI_PROVIDER = requested; delete process.env.AI_MODEL; }
  const diagnostics = providerDiagnostics();
  const probe = requested ? diagnostics.providers.find(p => p.provider === requested) : undefined;
  const configuration = probe ? { selected: { provider: probe.provider, model: probe.model }, ready: probe.configured } : diagnostics;
  console.log(JSON.stringify({ selected: configuration.selected, configured: configuration.ready }));
  if (!configuration.ready) { console.log("SKIPPED: no selected provider credential configured."); return; }
  try {
    const result = await (requested ? probeProviderJson : askJson)('Return JSON only: {"connected":true}.', "Confirm this API request by returning the required JSON object.", { ...(requested ? { provider: requested } : {}), task: "smoke", fallback: false, maxRetries: 0, timeoutMs: 15000, maxTokens: 256, validate: value => { if (value?.connected !== true) throw new Error("Unexpected smoke contract"); return { connected: true }; } });
    console.log(JSON.stringify({ verified: result.data.connected, metadata: result.metadata }));
  } catch (error) { console.log(JSON.stringify({ verified: false, error: normalizeProviderError(error) })); process.exitCode = 1; }
})();
