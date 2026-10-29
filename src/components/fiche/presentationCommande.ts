// src/components/fiche/presentationCommande.ts
//
// Présentation d'une commande à l'ÉCRAN (accueil vendeur, liste des commandes,
// fiche) — propriétaire : design-ux. Fonctions pures, testées seules
// (presentationCommande.test.ts). AUCUNE règle métier ici : rien n'est refusé,
// rien n'est calculé sur un montant ; on choisit seulement quoi montrer, dans
// quel ordre et avec quels mots (vouvoiement, pas de capitales criées : le
// bon imprimé garde les siennes, src/lib/ticketCanvas.ts).
//
// Imports relatifs avec extension : module exécuté tel quel par `node --test`.

import { familleDuProduit } from '../../catalogue/familles.ts';
import { LIBELLES_SELON_GOUT } from '../../catalogue/libellesSelonGout.ts';
import { libelleSelonGout } from '../../domaine/libelles.ts';
import { niveauRetard } from '../../domaine/retard.ts';
import { LIBELLES_FORME } from '../../domaine/messages.ts';
import { formaterHeure, lireHeure } from '../../domaine/reglement.ts';
import { formaterQuantite } from '../../domaine/unites.ts';
import { attendUnVirement, typesDeCommande, type Commande, type LigneCommande, type StatutCommande, type TypeCommande } from '../../lib/commandes.ts';
import { lectureQuantite } from '../../lib/ticketCanvas.ts';

/* ---------------------------------------------------------------- Statut */

/**
 * Statut tel qu'on le DIT au vendeur (propriétaire, 28/10/2026 : « remise »
 * prêtait à confusion avec une réduction de prix). Seuls les mots changent :
 * les valeurs en base et l'API restent `a_imprimer`, `imprimee`, `remise`…
 */
export const LIBELLE_STATUT_ECRAN: Record<StatutCommande, string> = {
  a_imprimer: 'Bon à imprimer',
  imprimee: 'Bon imprimé',
  remise: 'Retirée par le client',
  annulee: 'Annulée',
};

/** Le geste « le client est venu chercher sa commande ». */
export const GESTE_RETRAIT = 'Marquer retirée';

/* ----------------------------------------------------------------- Heure */

/** « 14:30 » → « 14h30 » (comme sur les affiches) ; vide → null ; illisible → tel quel. */
export function heureLisible(heure: string | null | undefined): string | null {
  const t = (heure ?? '').trim();
  if (!t) return null;
  const m = lireHeure(t);
  return m === null ? t : formaterHeure(m);
}

/* ---------------------------------------------------------------- Lignes */

/** Ligne prête à afficher : quantité, libellé (catalogue, à la lettre), détails. */
export type LigneAffichee = {
  /** « 2 × », « 0,750 kg », « 20 parts ». */
  quantite: string;
  libelle: string;
  /** Goût(s), chiffres ou lettres, forme, photo, déco, écriture, précision — dans l'ordre du pâtissier. */
  details: string[];
  /** Écriture portée par la LIGNE (une par gâteau), si le modèle la transmet. */
  ecriture: string | null;
  /** Supplément déclaré au catalogue (Écriture, Pâte à sucre…) : montré après les gâteaux. */
  supplement: boolean;
};

const texte = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Écriture d'une ligne. Le modèle « une écriture PAR GÂTEAU » est en cours
 * (agent `commandes-traiteur`) : le champ `texteGateau` de la ligne est lu
 * s'il existe, sans être exigé par le type.
 */
export function ecritureDeLigne(ligne: object): string | null {
  return texte((ligne as { texteGateau?: unknown }).texteGateau) || null;
}

function estSupplement(ligne: LigneCommande): boolean {
  const p = ligne.produitCatalogue;
  if (!p?.categorie || !p.nom || !p.regimePrix) return false;
  return familleDuProduit(p.regimePrix === 'A' ? 'comptoir' : 'sur-commande', p.categorie, p.nom) === 'supplement';
}

/** Une ligne de commande, en mots d'écran. */
export function ligneAffichee(ligne: LigneCommande): LigneAffichee {
  const lecture = lectureQuantite(ligne);
  const quantite =
    lecture === 'kg'
      ? formaterQuantite('kg', ligne.quantite)
      : lecture === 'piece'
        ? `${formaterQuantite('piece', ligne.quantite)} ×`
        : `${formaterQuantite('piece', ligne.quantite)} parts`;
  // Bavarois goût Fraisier → « Fraisier » : le nom dit le goût (donnée explicite).
  const nomSelonGout = libelleSelonGout(ligne.produitCatalogue?.cleCatalogue, ligne.gouts, LIBELLES_SELON_GOUT);
  const gouts = (ligne.gouts ?? []).map((g) => g.trim()).filter(Boolean);
  const details: string[] = [];
  if (texte(ligne.formes)) details.push(`Chiffres ou lettres : ${texte(ligne.formes)}`);
  if (!nomSelonGout) {
    if (gouts.length === 1) details.push(gouts[0]);
    else gouts.forEach((g, i) => details.push(`Étage ${i + 1} : ${g}`));
  }
  const forme = texte(ligne.forme);
  if (forme) details.push(forme === 'carre' || forme === 'rond' ? LIBELLES_FORME[forme] : forme);
  if (texte(ligne.photoModele)) details.push(`Photo ${texte(ligne.photoModele)}`);
  const decorations = (ligne.decorations ?? []).map((d) => d.trim()).filter(Boolean);
  if (decorations.length) details.push(`Déco : ${decorations.join(', ')}`);
  const ecriture = ecritureDeLigne(ligne);
  // « Écriture : » devant le texte : sans étiquette, on ne sait pas que c'est à écrire (28/10/2026).
  if (ecriture) details.push(`Écriture : « ${ecriture} »`);
  if ((ligne as { photoImprimee?: unknown }).photoImprimee === true) details.push('Photo à imprimer');
  if (texte(ligne.precision)) details.push(texte(ligne.precision));
  return { quantite, libelle: nomSelonGout ?? ligne.libelle, details, ecriture, supplement: estSupplement(ligne) };
}

/** true : la commande porte écriture et photo par gâteau (lot 2), sur ses lignes. */
export function infosParGateau(c: Pick<Commande, 'lignes'>): boolean {
  return c.lignes.some((l) => {
    const x = l as { texteGateau?: unknown; sansEcriture?: unknown; photoImprimee?: unknown };
    return x.texteGateau != null || x.sansEcriture != null || x.photoImprimee != null;
  });
}

/**
 * Écriture de la COMMANDE, à montrer seulement si aucune ligne ne porte la
 * sienne (ancien modèle : une écriture par commande). null sinon.
 */
export function ecritureDeCommande(c: Pick<Commande, 'texteGateau' | 'lignes'>): string | null {
  if (c.lignes.some((l) => ecritureDeLigne(l))) return null;
  return texte(c.texteGateau) || null;
}

/* ---------------------------------------------------------------- Résumé */

export type ResumeCommande = {
  /** Les premiers articles, gâteaux avant suppléments ; ordre de saisie sinon. */
  lignes: LigneAffichee[];
  /** Articles non montrés (« et 2 autres »), à voir dans la fiche. */
  autres: number;
};

/**
 * Résumé compact d'une commande pour une liste : `max` articles au plus, les
 * gâteaux et produits avant les suppléments (l'Écriture n'est pas ce qu'on
 * cherche des yeux). L'écriture de la commande (ancien modèle) s'ajoute aux
 * détails du premier article qui n'est pas un supplément.
 */
export function resumeCommande(c: Pick<Commande, 'texteGateau' | 'lignes'>, max = 2): ResumeCommande {
  const affichees = c.lignes.map(ligneAffichee);
  const ordonnees = [...affichees.filter((l) => !l.supplement), ...affichees.filter((l) => l.supplement)];
  const ecriture = ecritureDeCommande(c);
  if (ecriture) {
    const k = ordonnees.findIndex((l) => !l.supplement);
    const cible = k >= 0 ? k : 0;
    if (ordonnees[cible]) ordonnees[cible] = { ...ordonnees[cible], details: [...ordonnees[cible].details, `Écriture : « ${ecriture} »`] };
  }
  const n = Math.max(0, max);
  return { lignes: ordonnees.slice(0, n), autres: Math.max(0, ordonnees.length - n) };
}

/** « et 2 autres articles » / « et 1 autre article » / chaîne vide. */
export function texteAutres(autres: number): string {
  if (autres <= 0) return '';
  return autres === 1 ? 'et 1 autre article' : `et ${autres} autres articles`;
}

/* ------------------------------------------------------- Tri et filtres */

/** Par heure de retrait (sans heure : en dernier), puis par numéro. Ne modifie pas la liste reçue. */
export function trierParHeure<T extends Pick<Commande, 'retraitHeure' | 'numero'>>(commandes: readonly T[]): T[] {
  const cle = (h: string | null) => {
    const m = lireHeure(h ?? '');
    return m === null ? Number.MAX_SAFE_INTEGER : m;
  };
  return [...commandes].sort((a, b) => cle(a.retraitHeure) - cle(b.retraitHeure) || a.numero.localeCompare(b.numero));
}

/** Ordre du contrôle segmenté de l'accueil (propriétaire, 28/10/2026). */
export const TYPES_FILTRE: readonly TypeCommande[] = ['patisserie', 'sale', 'boulangerie'];

export type ComptesParType = Record<TypeCommande | 'tout', number>;

/**
 * Nombre de commandes par type (types tirés du RAYON, `typesDeCommande`,
 * jamais du nom). Une commande mixte compte dans chacun de ses types, et
 * une seule fois dans « tout ».
 */
export function compterParType(commandes: readonly Pick<Commande, 'lignes'>[]): ComptesParType {
  const comptes: ComptesParType = { tout: commandes.length, boulangerie: 0, patisserie: 0, sale: 0 };
  for (const c of commandes) for (const t of typesDeCommande(c)) comptes[t] += 1;
  return comptes;
}

/** Commandes d'un type (null : toutes). */
export function filtrerParType<T extends Pick<Commande, 'lignes'>>(commandes: readonly T[], type: TypeCommande | null): T[] {
  return type === null ? [...commandes] : commandes.filter((c) => typesDeCommande(c).includes(type));
}

/* ------------------------------------------------- Groupes de la liste */

export type CleGroupe = 'aImprimer' | 'virements' | 'enRetard' | 'duJour' | 'aVenir';

/** Ordre d'affichage des groupes, et des filtres sous la recherche. */
export const GROUPES: readonly { cle: CleGroupe; titre: string; ton?: 'accent' | 'attention' | 'alerte' }[] = [
  { cle: 'aImprimer', titre: 'À imprimer', ton: 'accent' },
  { cle: 'virements', titre: 'Virements à vérifier', ton: 'attention' },
  { cle: 'enRetard', titre: 'Retraits en retard', ton: 'alerte' },
  { cle: 'duJour', titre: 'Aujourd’hui' },
  { cle: 'aVenir', titre: 'À venir' },
];

type CommandeListe = Pick<
  Commande,
  'client' | 'telephone' | 'numero' | 'statut' | 'retraitLe' | 'retraitHeure' | 'modePaiement' | 'acompteRecuLe'
>;

/** Recherche par nom, téléphone (chiffres seuls) ou numéro. */
export function chercherCommandes<T extends CommandeListe>(commandes: readonly T[], recherche: string): T[] {
  const q = recherche.trim().toLowerCase();
  if (!q) return [...commandes];
  const chiffres = q.replace(/\D/g, '');
  return commandes.filter(
    (c) =>
      c.client.toLowerCase().includes(q) ||
      c.numero.toLowerCase().includes(q) ||
      c.telephone.includes(q) ||
      (chiffres.length >= 3 && c.telephone.replace(/\D/g, '').includes(chiffres)),
  );
}

/**
 * Groupes de la liste des commandes (mêmes groupes qu'avant la refonte) ;
 * chaque groupe trié par date puis heure de retrait. Une commande peut
 * figurer dans « À imprimer » ET « Virements à vérifier ».
 */
export function grouperCommandes<T extends CommandeListe>(
  commandes: readonly T[],
  aujourdhui: string,
  /** Minutes depuis minuit à Bruxelles : en retard dès l'heure passée (29/10/2026). Absent : au jour près. */
  minutes?: number,
): Record<CleGroupe, T[]> {
  const parDate = (liste: T[]) =>
    trierParHeure(liste).sort((a, b) => a.retraitLe.localeCompare(b.retraitLe));
  const imprimees = commandes.filter((c) => c.statut !== 'a_imprimer');
  const enRetard = (c: T) =>
    minutes === undefined
      ? c.retraitLe.slice(0, 10) < aujourdhui
      : niveauRetard(c.retraitLe, c.retraitHeure, { date: aujourdhui, minutes }) !== null;
  return {
    aImprimer: parDate(commandes.filter((c) => c.statut === 'a_imprimer')),
    virements: parDate(commandes.filter(attendUnVirement)),
    enRetard: parDate(imprimees.filter(enRetard)),
    duJour: parDate(imprimees.filter((c) => c.retraitLe.slice(0, 10) === aujourdhui && !enRetard(c))),
    aVenir: parDate(imprimees.filter((c) => c.retraitLe.slice(0, 10) > aujourdhui)),
  };
}

/** « jeudi 29 octobre » → « Jeudi 29 octobre » (début de ligne). */
export function majusculeInitiale(t: string): string {
  return t ? t.charAt(0).toLocaleUpperCase('fr') + t.slice(1) : t;
}

/* ------------------------------------------------------- Téléphone */

/** Lien `tel:` (chiffres et « + » seulement), ou null si rien d'appelable. */
export function lienTelephone(telephone: string | null | undefined): string | null {
  const t = String(telephone ?? '').replace(/[^\d+]/g, '');
  return t.replace(/\D/g, '').length >= 6 ? `tel:${t}` : null;
}
