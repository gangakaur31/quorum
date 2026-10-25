const { spawnSync } = require("node:child_process");
const { readdirSync } = require("node:fs");
const path = require("node:path");
const files = readdirSync(path.join(__dirname, "../tests")).filter(f => f.endsWith(".test.ts")).map(f => `tests/${f}`);
const result = spawnSync(process.execPath, ["--require", "./scripts/test-register.cjs", "--test", "--test-concurrency=1", ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
