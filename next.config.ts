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
  // Fase A: hoofdmenu-herstructurering (spec §2). Oude paden blijven werken.
  async redirects() {
    return [
      { source: "/admin/bank", destination: "/admin/financien/bank", permanent: false },
      { source: "/admin/bank/:path*", destination: "/admin/financien/bank/:path*", permanent: false },
      { source: "/admin/kosten", destination: "/admin/financien/kosten", permanent: false },
      { source: "/admin/kosten/:path*", destination: "/admin/financien/kosten/:path*", permanent: false },
      { source: "/admin/tellers", destination: "/admin/meterstanden", permanent: false },
      { source: "/admin/tellers/:path*", destination: "/admin/meterstanden/:path*", permanent: false },
      { source: "/admin/config", destination: "/admin/instellingen", permanent: false },
    ];
  },
};

export default nextConfig;
