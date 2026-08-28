import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Ruimte voor het uploaden van bewijsstukken (PDF/afbeelding) bij kosten.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
