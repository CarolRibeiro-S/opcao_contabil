import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "@napi-rs/canvas" é dependência nativa (binário por plataforma) do
  // pdfjs-dist usado internamente pelo pdf-parse; ele é quem fornece o
  // polyfill de DOMMatrix em ambiente Node. Sem estar na lista de pacotes
  // externos, o Next empacota esse require nativo e quebra na Vercel
  // (funciona local no `next dev`, falha no build/serverless).
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
};

export default nextConfig;
