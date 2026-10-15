// src/lib/serveur/joursFermes.ts
//
// LOI 3 — lecture des jours fermés ACTIFS (table "JourFerme") sous la forme
// de données attendue par le domaine (`src/domaine/calendrier.ts`,
// propriétaire `regles-metier`). Propriétaire de ce fichier : `base-donnees`.
//
// AUCUNE règle ici : on ne décide pas si une date est fermée, on lit la
// liste. La règle (priorité ouverture exceptionnelle > congés > autres) vit
// dans le domaine, et sa traduction en base dans `fermeture_du_jour(d)`
// (migration 20261015120000_jours_fermes).
//
// Forme de sortie = type `JourFerme` de src/domaine/calendrier.ts (vérifié
// par le test). Pas d'import de Prisma (ni valeur, ni type) : la conversion est une
// fonction pure testable avec `node --test`, et la lecture reçoit le client
// en paramètre.

/** Natures possibles (= enum Prisma `NatureFermeture`). */
export type NatureFermeture =
  | 'hebdomadaire'
  | 'ferie'
  | 'exceptionnel'
  | 'conges'
  | 'ouverture_exceptionnelle';

const NATURES: readonly NatureFermeture[] = [
  'hebdomadaire',
  'ferie',
  'exceptionnel',
  'conges',
  'ouverture_exceptionnelle',
];

/**
 * Donnée transmise au domaine. Dates en jour calendaire « AAAA-MM-JJ »
 * (colonnes `@db.Date` : pas d'heure, pas de fuseau), bornes INCLUSES.
 *  - hebdomadaire : jourSemaineIso 1..7 (1 = lundi), dateDebut/dateFin =
 *    période d'application facultative ;
 *  - autres natures : jourSemaineIso null, dateDebut obligatoire,
 *    dateFin null = un seul jour.
 */
export type JourFermeDonnee = {
  /** Sert de départage au domaine (« la plus ancienne ») ; liste triée par id. */
  id: number;
  nature: NatureFermeture;
  jourSemaineIso: number | null;
  dateDebut: string | null;
  dateFin: string | null;
  libelle: string;
};

/** Forme d'une ligne Prisma `JourFerme` (seuls les champs lus). */
export type LigneJourFerme = {
  id: number;
  nature: string;
  jourSemaineIso: number | null;
  dateDebut: Date | null;
  dateFin: Date | null;
  libelle: string;
};

/** Client minimal : `prisma` (src/lib/prisma.ts) le satisfait. */
export type LecteurJoursFermes = {
  jourFerme: {
    findMany(args: {
      where: { actif: true };
      select: { id: true; nature: true; jourSemaineIso: true; dateDebut: true; dateFin: true; libelle: true };
      orderBy: { id: 'asc' };
    }): Promise<LigneJourFerme[]>;
  };
};

/**
 * Une colonne `@db.Date` arrive de Prisma comme un `Date` à minuit UTC :
 * la partie UTC est donc le jour calendaire stocké, quel que soit le
 * fuseau du serveur.
 */
function jourCalendaire(d: Date | null, champ: string): string | null {
  if (d === null) return null;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    throw new Error(`JourFerme : ${champ} illisible.`);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Conversion pure ligne Prisma → donnée du domaine.
 * Une ligne mal formée (nature inconnue, jour hors 1..7) lève : la base la
 * refuse déjà (contrainte "JourFerme_forme"), donc si elle arrive ici,
 * c'est un schéma désynchronisé — mieux vaut échouer que d'ouvrir à tort.
 */
export function versDonneeJourFerme(ligne: LigneJourFerme): JourFermeDonnee {
  if (!(NATURES as readonly string[]).includes(ligne.nature)) {
    throw new Error(`JourFerme : nature inconnue « ${ligne.nature} ».`);
  }
  const j = ligne.jourSemaineIso;
  if (j !== null && !(Number.isInteger(j) && j >= 1 && j <= 7)) {
    throw new Error(`JourFerme : jourSemaineIso hors 1..7 (${j}).`);
  }
  return {
    id: ligne.id,
    nature: ligne.nature as NatureFermeture,
    jourSemaineIso: j,
    dateDebut: jourCalendaire(ligne.dateDebut, 'dateDebut'),
    dateFin: jourCalendaire(ligne.dateFin, 'dateFin'),
    libelle: ligne.libelle,
  };
}

/** Lit les jours fermés actifs (une requête), dans l'ordre de création. */
export async function lireJoursFermes(client: LecteurJoursFermes): Promise<JourFermeDonnee[]> {
  const lignes = await client.jourFerme.findMany({
    where: { actif: true },
    select: { id: true, nature: true, jourSemaineIso: true, dateDebut: true, dateFin: true, libelle: true },
    orderBy: { id: 'asc' },
  });
  return lignes.map(versDonneeJourFerme);
}
