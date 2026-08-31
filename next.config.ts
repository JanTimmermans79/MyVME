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
  // Menu-herstructurering fase 3 (spec §2). Deze paden waren vóór de
  // herstructurering in gebruik; de redirects houden oude bookmarks levend.
  async redirects() {
    return [
      { source: "/admin/bank", destination: "/admin/financien/bank", permanent: true },
      { source: "/admin/bank/:path*", destination: "/admin/financien/bank/:path*", permanent: true },
      { source: "/admin/kosten/document", destination: "/admin/financien/document", permanent: true },
      { source: "/admin/kosten", destination: "/admin/financien/zicht/kosten", permanent: true },
      { source: "/admin/tellers", destination: "/admin/meterstanden", permanent: true },
      { source: "/admin/tellers/:path*", destination: "/admin/meterstanden/:path*", permanent: true },
      { source: "/admin/config", destination: "/admin/instellingen", permanent: true },
    ];
  },
};

export default nextConfig;
