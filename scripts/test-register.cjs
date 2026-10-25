// Test-only TS loader; application runtime never uses mocks or this server-only shim.
const ts = require("typescript");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const original = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name === "server-only") return path.join(__dirname, "test-server-only.cjs");
  return original.call(this, name.startsWith("@/") ? path.join(__dirname, "..", name.slice(2)) : name, parent, ...rest);
};
require.extensions[".ts"] = require.extensions[".tsx"] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  module._compile(result.outputText, filename);
};
