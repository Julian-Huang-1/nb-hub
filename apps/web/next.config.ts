import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@nb-hub/core", "@nb-hub/ui", "@nb-hub/views"],
};

export default config;
