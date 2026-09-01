import type { MetadataRoute } from 'next';

/**
 * Manifeste d'application web.
 *
 * C'est lui qui rend l'application installable : « Ajouter à l'écran d'accueil »
 * sur iOS, « Installer l'application » sur Android. Une fois posée, elle
 * s'ouvre en plein écran, sans barre d'adresse — le personnel ne voit plus la
 * différence avec une application native.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PAin PAtisserie — Inventaire',
    short_name: 'PAin PAtisserie',
    description:
      'Comptage du restant, production et prévisions quotidiennes de la boulangerie.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f4f2',
    theme_color: '#f04e23',
    lang: 'fr',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android peut rogner les bords : cette version garde le logo dans la
      // zone sûre centrale, sinon le "PA" se retrouve amputé sur certains
      // téléphones qui découpent l'icône en cercle ou en goutte.
      { src: '/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
