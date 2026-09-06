import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // La pastille de developpement de Next.js, en bas a gauche. Elle n'apparait
  // jamais en production, mais elle gene la lecture des ecrans de saisie sur
  // un telephone : elle se pose juste sur le total de la barre du bas.
  devIndicators: false,
};

export default nextConfig;
