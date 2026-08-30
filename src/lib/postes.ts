// src/lib/postes.ts
// Qui produit quoi. Sert à ne montrer à chacun que sa propre liste.

export const POSTES = ['patissier', 'boulanger', 'traiteur'] as const;
export type Poste = (typeof POSTES)[number];

export const LIBELLE_POSTE: Record<Poste, string> = {
  patissier: 'Pâtissier',
  boulanger: 'Boulanger',
  traiteur: 'Traiteur',
};

/** Ce que le poste fabrique, affiché sous le titre des écrans du fournil. */
export const DESCRIPTION_POSTE: Record<Poste, string> = {
  patissier: 'Viennoiserie, pâtisserie, makla et beignets',
  boulanger: 'Pains, pains spéciaux et briochés',
  traiteur: 'Msemen salés, salades et plats préparés',
};

export function estPoste(valeur: string | null | undefined): valeur is Poste {
  return !!valeur && (POSTES as readonly string[]).includes(valeur);
}

/** Ordre d'affichage des zones du magasin, indépendant de l'ordre alphabétique. */
export const ORDRE_CATEGORIES = [
  'Pains',
  'Salé',
  'Makla',
  'Viennoiserie',
  'Pâtisserie',
] as const;

export function trierCategories(categories: string[]): string[] {
  const rang = (c: string) => {
    const i = (ORDRE_CATEGORIES as readonly string[]).indexOf(c);
    return i === -1 ? ORDRE_CATEGORIES.length : i;
  };
  return [...categories].sort((a, b) => rang(a) - rang(b) || a.localeCompare(b, 'fr'));
}
