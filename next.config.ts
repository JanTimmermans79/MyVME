import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (+ pdfjs) niet bundelen; server-side vereist.
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    serverActions: {
      // Ruimte voor het uploaden van bewijsstukken en bank-PDF's.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
