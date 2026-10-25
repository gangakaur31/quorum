import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The bottom-left N badge is a Next.js development-only route indicator, not product UI.
  // Disable it so local demos match the production Quorum experience.
  devIndicators: false,
  outputFileTracingExcludes: { "*": [".env*", ".quorum-data/**/*", ".browser-check/**/*", "artifacts/**/*", ".venv/**/*"] },
  // Supports normal local access through both common development hosts. Sandboxed generated
  // artifacts are separately stripped of /_next asset references and do not need an exception.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default nextConfig;
