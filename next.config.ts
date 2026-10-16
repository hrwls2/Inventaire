import type { NextConfig } from "next";
import { writePortableDashboard } from "./src/lib/portable-dashboard";

export default async function nextConfig(): Promise<NextConfig> {
  // Tente d'inclure une version autonome dans le déploiement.
  // Ne doit jamais faire échouer la compilation (voir DEPLOIEMENT.md).
  await writePortableDashboard();

  return {
    outputFileTracingIncludes: {
      "/api/download": [
        "./public/dashboard.html",
        "./public/styles.css",
        "./public/config.js",
        "./public/local-inventory.js",
        "./public/app.js",
        "./public/fonts/*",
      ],
    },
    async rewrites() {
      return {
        beforeFiles: [{ source: "/", destination: "/dashboard.html" }],
        afterFiles: [],
        fallback: [],
      };
    },
  };
}
