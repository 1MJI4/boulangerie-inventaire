// src/lib/auth/roles.ts
//
// Les deux niveaux d'accès de l'application (décision du propriétaire,
// 15/10/2026 : pas de compte par employé). Propriétaire : agent `securite`.
//
//   tablette → une tablette installée avec le CODE DE TABLETTE : tout ce qu'un
//              employé fait (commandes, inventaires, impression, lecture).
//   gerant   → la même tablette, après saisie du CODE GÉRANT (élévation de
//              courte durée) : en plus, écritures tarifs, produits, gâteaux,
//              réorganisation du catalogue.
//
// Un rôle plus étendu englobe les droits du rôle inférieur.

export const ROLES = ['tablette', 'gerant'] as const;
export type Role = (typeof ROLES)[number];

const RANG: Record<Role, number> = { tablette: 1, gerant: 2 };

/** Libellé destiné à un humain (messages d'erreur). */
export const LIBELLE_ROLE: Record<Role, string> = {
  tablette: 'personnel du magasin',
  gerant: 'gérant',
};

export function estRole(valeur: unknown): valeur is Role {
  return typeof valeur === 'string' && (ROLES as readonly string[]).includes(valeur);
}

/** Vrai si `roleDetenu` suffit pour une action qui exige `roleRequis`. */
export function aLeRole(roleDetenu: Role, roleRequis: Role): boolean {
  return RANG[roleDetenu] >= RANG[roleRequis];
}
