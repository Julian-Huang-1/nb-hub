import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(import.meta.dirname, "../.."),
  transpilePackages: ["@nb-hub/core", "@nb-hub/ui", "@nb-hub/views"],
};

export default config;
