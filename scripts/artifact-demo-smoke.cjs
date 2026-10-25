// Explicit real generation of the authored demo brief; no project/customer record is created.
require("./test-register.cjs");
require("@next/env").loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const fs = require("node:fs/promises"), path = require("node:path");
const { askJson, normalizeProviderError } = require("../lib/agents/providers.ts");
const { landingSystemPrompt } = require("../lib/prompts.ts");
const { ensureLandingArtifact } = require("../lib/agents/validation.ts");
const { demoOffer } = require("../lib/demo-scenario.ts");
const { knowledgeContext } = require("../lib/knowledge.ts");
(async () => {
  try {
    const sample = demoOffer();
    const result = await askJson(landingSystemPrompt, JSON.stringify({ idea: sample.input, assumptions: sample.assumptions, retrieved: knowledgeContext({ sessionId: "internal-artifact-demo-probe", idea: sample.input, assumptions: sample.assumptions }, "generate") }), { task: "generate", validate: ensureLandingArtifact, deadlineMs: 55000 });
    const directory = path.resolve("artifacts/demo-polish"); await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "live-artifact.html"), result.data.html);
    await fs.writeFile(path.join(directory, "live-artifact.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ verified: true, title: result.data.title, htmlCharacters: result.data.html.length, metadata: result.metadata, saved: "artifacts/demo-polish/live-artifact.html" }));
  } catch (error) { console.log(JSON.stringify({ verified: false, error: normalizeProviderError(error) })); process.exitCode = 1; }
})();
