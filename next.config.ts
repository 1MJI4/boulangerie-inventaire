import type { NextConfig } from "next";

const enDeveloppement = process.env.NODE_ENV !== "production";

// En-têtes de sécurité (agent `securite`). Source unique : netlify.toml n'en
// redéclare aucun, pour ne jamais envoyer deux politiques contradictoires.
//
// CSP : Next injecte des scripts en ligne pour l'hydratation, d'où
// 'unsafe-inline' sur script-src (une CSP à nonce imposerait le rendu dynamique
// de toutes les pages). Tout le reste est fermé : aucune origine extérieure,
// aucun cadre, aucun plugin. Les polices next/font sont servies par l'application.
const politiqueContenu = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${enDeveloppement ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // data:/blob: : tickets dessinés sur canvas et aperçus PNG.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${enDeveloppement ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(enDeveloppement ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const entetesSecurite = [
  { key: "Content-Security-Policy", value: politiqueContenu },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Doublon volontaire de frame-ancestors pour les navigateurs anciens.
  { key: "X-Frame-Options", value: "DENY" },
  // camera=(self) : réservé à une future lecture de code-barres à l'inventaire.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

// Développement seulement : origines autorisées à charger les ressources
// internes de `next dev` (/_next/*, rechargement à chaud) quand une tablette
// ouvre l'application par l'IP wifi du poste. Limité aux réseaux privés
// (RFC 1918). Sans effet en production (Next ne le lit que dans `next dev`),
// et sans lien avec la défense CSRF des écritures (src/lib/auth/origine.ts).
// Le motif « * » de Next remplace exactement un segment d'adresse.
const reseauxPrives = [
  "192.168.*.*",
  "10.*.*.*",
  ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: reseauxPrives,
  // La pastille de developpement de Next.js, en bas a gauche. Elle n'apparait
  // jamais en production, mais elle gene la lecture des ecrans de saisie sur
  // un telephone : elle se pose juste sur le total de la barre du bas.
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: entetesSecurite }];
  },
};

export default nextConfig;
