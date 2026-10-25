// Explicit developer probe: one tiny real task, Claude first; Groq only after failure.
// No project data, source records, contacts or prompts are logged or persisted.
require("./test-register.cjs");
require("@next/env").loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const { askJson, providerDiagnostics, normalizeProviderError } = require("../lib/agents/providers.ts");
(async () => {
  console.log(JSON.stringify({ selected: providerDiagnostics().selected, policy: "Claude first; Groq after failure only" }));
  try {
    const result = await askJson('Return JSON only: {"connected":true}.', "Verify this request by returning the required JSON object.", {
      task: "smoke", maxTokens: 256, maxRetries: 0, maxRepairs: 0, deadlineMs: 30000,
      validate: value => { if (value?.connected !== true) throw new Error("Unexpected smoke contract"); return { connected: true }; },
    });
    console.log(JSON.stringify({ verified: true, metadata: result.metadata }));
  } catch (error) { console.log(JSON.stringify({ verified: false, error: normalizeProviderError(error) })); process.exitCode = 1; }
})();
