// Explicit pre-demo check. Small real inference/search requests may incur provider cost.
require("./test-register.cjs");
require("@next/env").loadEnvConfig(process.cwd());
const { runPreflight } = require("../lib/preflight.ts");
const { writeFile, mkdir } = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const args = process.argv.slice(2), options = {};
  let json = false, output;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") { console.log("Usage: npm run check:apis -- [--base-url http://localhost:3000] [--require groq,tavily,redis] [--timeout 15000] [--json] [--output artifacts/preflight.json]\nChecks every configured AI provider with real inference, optional search, and the selected storage. Missing optional services are SKIP; missing required services are FAIL. --base-url also checks running app routes without creating projects or running full agents. Any FAIL exits 1; invalid CLI options exit 2. Credentials and upstream response bodies are never printed."); return; }
    if (arg === "--json") { json = true; continue; }
    const value = args[++i];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}.`);
    if (arg === "--base-url") options.baseUrl = value;
    else if (arg === "--timeout") options.timeoutMs = Number(value);
    else if (arg === "--require") { const services = value.split(","); if (services.some(s => !["gemini", "groq", "anthropic", "tavily", "redis"].includes(s))) throw new Error("--require accepts gemini, groq, anthropic, tavily and redis."); options.require = services; }
    else if (arg === "--output") output = value;
    else throw new Error(`Unknown option: ${arg}. Use --help.`);
  }
  if (!json) { console.log("Quorum pre-demo API check\nSmall real API probes; no fallback, project creation or fabricated responses.\n"); options.onResult = result => console.log(`${result.status.padEnd(4)}  ${result.name} (${result.latencyMs}ms)\n      ${result.message}`); }
  const report = await runPreflight(options);
  if (output) { const target = path.resolve(output); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, JSON.stringify(report, null, 2) + "\n"); }
  if (json) console.log(JSON.stringify(report, null, 2));
  else { console.log(`\n${report.passed ? "PASS" : "NOT READY"}: ${report.checks.filter(c => c.status === "PASS").length} passed, ${report.checks.filter(c => c.status === "FAIL").length} failed, ${report.checks.filter(c => c.status === "SKIP").length} skipped. Primary provider: ${report.primaryProvider || "invalid configuration"}.`); if (output) console.log(`Report saved to ${output}`); if (!options.baseUrl) console.log("To include local API routes, start Quorum and add --base-url http://localhost:3000."); }
  process.exitCode = report.passed ? 0 : 1;
}
main().catch(() => { console.error("Preflight could not complete. Check the command options with --help and inspect local configuration. No credentials or upstream error text were printed."); process.exitCode = 2; });
