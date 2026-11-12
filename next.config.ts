import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La ruta del recibo lee el logotipo del disco (src/features/pagos/recibo/logo.ts); el trazado
  // de archivos no lo detecta solo. La clave es un glob de picomatch: los corchetes van escapados.
  outputFileTracingIncludes: {
    "/api/recibos/\\[pagoId\\]": ["./public/brand/weadmi-logotipo-recibo.png"],
  },
};

export default nextConfig;
