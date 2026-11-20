// src/lib/coordonneesMagasin.ts
//
// Site et réseaux de Pain Pâtisserie, imprimés au pied du ticket CLIENT.
// Une seule source : changer un compte se fait ICI, jamais dans un gabarit.
// Ce ne sont pas des règles métier (LOI 3 ou 6) : des coordonnées publiques.

export const SITE_WEB = 'pain-patisserie.be';

/** Même identifiant sur les trois réseaux (liens de partage nettoyés de leurs paramètres de suivi). */
export const IDENTIFIANT_RESEAUX = '@painpatisserie';

/** Adresse encodée dans le QR du ticket client. Autre destination ? On ne change que cette ligne. */
export const ADRESSE_QR = `https://${SITE_WEB}/`;

export const RESEAUX = ['Instagram', 'Facebook', 'TikTok'] as const;

/** Lignes imprimées au pied du ticket client, centrées, dans l'ordre. */
export const LIGNES_PIED_CLIENT: readonly string[] = [
  SITE_WEB,
  `${RESEAUX.join(' · ')} : ${IDENTIFIANT_RESEAUX}`,
];
