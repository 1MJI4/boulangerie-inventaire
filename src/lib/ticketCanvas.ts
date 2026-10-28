// src/lib/ticketCanvas.ts
//
// Le ticket dessiné au point près, sur un canvas de 576 points de large —
// la définition exacte de la tête thermique d'une 80 mm (203 dpi sur 72 mm
// imprimables).
//
// Pourquoi abandonner le HTML imprimé par le navigateur : parce qu'il n'y a
// alors aucun moyen de savoir ce qui sortira vraiment. La largeur dépend du
// pilote, la hauteur de page d'une propriété CSS que les navigateurs
// interprètent chacun à leur façon, et l'aperçu écran ment. Ici le même
// dessin sert d'aperçu et de fichier envoyé à l'imprimante : ce que le
// vendeur voit est, au point près, ce que la machine imprimera.
//
// Tout est en noir pur, sans gris : une tête thermique ne connaît que deux
// états, et un gris tramé sort baveux.

import type { Commande, LigneCommande } from './commandes';
import { formaterEuros } from '../domaine/argent.ts';
import { formaterQuantite, totalLigne } from '../domaine/unites.ts';
import { formaterHeure, lireHeure, nomJour } from '../domaine/reglement.ts';
import { LIBELLES_FORME } from '../domaine/messages.ts';
import { baseDuSupplement, familleDuProduit } from '../catalogue/familles.ts';

export const DESTINATIONS = ['CLIENT', 'BUREAU', 'MAGASIN', 'ATELIER'] as const;
export type Destination = (typeof DESTINATIONS)[number];

/** 72 mm imprimables à 203 dpi. Ne pas changer sans changer de matériel. */
export const LARGEUR = 576;
/** Marge intérieure : en dessous, le massicot mord sur le texte. */
const MARGE = 16;
const UTILE = LARGEUR - MARGE * 2;

/** Hauteur de la zone de dessin libre, en points (≈ 60 mm). */
const ZONE_LIBRE = 480;

const SANS = 'Arial, Helvetica, sans-serif';

type Contexte = CanvasRenderingContext2D;

/* ------------------------------------------- Formatage pur (testé seul) */

/** Une consigne d'atelier, imprimée SOUS le produit, sur toute la largeur. */
export type Consigne = {
  texte: string;
  /** Number Cake : les chiffres ou lettres, imprimés plus grand. */
  grand?: boolean;
};

/** Une ligne de produit prête à imprimer, sans aucun calcul côté gabarit. */
export type LigneTicket = {
  /** « 12 × » à la pièce, « 0,750 kg » au kilo (LOI 2), VIDE pour un prix
      par personne : le nombre de parts est dit en toutes lettres (`parts`). */
  quantite: string;
  /** Libellé du catalogue, à la lettre (LOI 5). */
  libelle: string;
  /** Supplément par personne : « — 20 parts », imprimé à la suite du libellé. */
  complementLibelle: string | null;
  /** Gâteau vendu par personne : « 1 gâteau — 20 PARTS » (propriétaire, 28/10/2026). */
  parts: string | null;
  /** Prix par personne appliqué (« … € par personne »), lu sur la ligne, jamais recalculé. */
  prixUnitaire: string | null;
  precision: string | null;
  /** Number Cake : « CHIFFRES OU LETTRES : 2  5 », déjà mis en forme (`chiffresOuLettresAImprimer`). */
  formes: string | null;
  /** R63 : « FORME : CARRÉ » / « FORME : ROND » (`formeAImprimer`), null sans forme. */
  forme: string | null;
  /** Galerie de modèles (propriétaire, 26/10/2026) : « Photo sélectionnée : G043 »
      (`photoModeleAImprimer`), null sans photo. Texte seul, jamais l'image. */
  photoModele: string | null;
  /** R62 : « GOÛT : FRAMBOISE », ou une ligne par étage (`goutsLignesAImprimer`). */
  gouts: string[] | null;
  /** R62 : décorations facultatives, « Oreo, Kinder Bueno ». */
  decorations: string | null;
  /** Total formaté par le domaine, ou « à confirmer » si le total ne peut pas être calculé. */
  prix: string;
  /** Ligne libre (hors catalogue) : son prix doit être validé par le pâtissier.
      Mention interne : toujours false sur l'exemplaire CLIENT. */
  aConfirmer: boolean;
};

/**
 * Espace insécable : colle une étiquette (« GOÛT : », « ÉTAGE 1 : ») à son
 * premier mot, pour qu'aucune découpe ne la coupe en deux (« ÉTAGE / 1 : »).
 * `couperTexte` ne coupe jamais sur une insécable.
 */
export const INSECABLE = '\u00a0';

/** « ÉTAGE 1 : » + « MOUSSE CHOCOLAT » → « ÉTAGE␣1␣:␣MOUSSE CHOCOLAT » (␣ = insécable). */
export function collerEtiquette(etiquette: string, valeur: string): string {
  const colle = etiquette.trim().replace(/ +/g, INSECABLE);
  return `${colle}${INSECABLE}${valeur.replace(/^ +/, '')}`;
}

export const MENTION_LIGNE_LIBRE = 'à confirmer par le pâtissier';

/**
 * Commande modifiée APRÈS avoir été imprimée (22/10/2026) : instant de la
 * dernière modification qui l'a renvoyée « à réimprimer » (historique tracé
 * par l'API), sinon null. Le ticket le dit, pour qu'on jette l'ancien.
 */
export function modifieeApresImpression(commande: Pick<Commande, 'evenements'>): string | null {
  const e = (commande.evenements ?? [])
    .filter((x) => x.action === 'modification' && (x.detail ?? '').includes('à réimprimer'))
    .sort((a, b) => b.quand.localeCompare(a.quand))[0];
  return e ? e.quand : null;
}

/** « 22/10 à 18h40 », heure de Bruxelles. */
export function dateHeureCourte(iso: string): string {
  const d = new Date(iso);
  const jour = d.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Brussels' });
  const heure = d
    .toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' })
    .replace(':', 'h');
  return `${jour} à ${heure}`;
}

/**
 * Bandeau « commande modifiée » commun aux trois rendus (Star, ticket
 * navigateur, A6) : une seule règle, pour qu'un format de secours ne laisse
 * jamais deux bons valables en apparence (audit du 28/10/2026, point 2.9).
 * Exemplaire CLIENT : simple « Version du … », sans consigne interne.
 */
export function bandeauModification(
  commande: Pick<Commande, 'evenements'>,
  destination: Destination
): { titre: string; consigne: string | null } | null {
  const quand = modifieeApresImpression(commande);
  if (!quand) return null;
  if (destination === 'CLIENT') return { titre: `Version du ${dateHeureCourte(quand)}`, consigne: null };
  return { titre: `MODIFIÉE le ${dateHeureCourte(quand)}`, consigne: 'Jetez l’ancien ticket' };
}

/**
 * Goût(s) d'un gâteau sur commande (R62), en capitales pour l'atelier :
 * « GOÛT : FRAMBOISE » ; pièce montée : « ÉTAGE 1 : CHOCOLAT · ÉTAGE 2 : VANILLE ».
 * Forme sur une ligne, gardée pour les écrans ; le bon imprime une ligne par
 * étage (`goutsLignesAImprimer`).
 */
export function goutsAImprimer(gouts: readonly string[] | null | undefined): string | null {
  const g = (gouts ?? []).map((x) => x.trim()).filter(Boolean);
  if (g.length === 0) return null;
  if (g.length === 1) return `GOÛT : ${g[0].toUpperCase()}`;
  return g.map((x, i) => `ÉTAGE ${i + 1} : ${x.toUpperCase()}`).join(' · ');
}

/**
 * Goût(s) pour le bon (propriétaire, 28/10/2026) : une ligne par étage,
 * « ÉTAGE 1 : CHOCOLAT » puis « ÉTAGE 2 : VANILLE », étiquette collée au goût
 * par des insécables — jamais « ÉTAGE / 1 : ». null sans goût.
 */
export function goutsLignesAImprimer(gouts: readonly string[] | null | undefined): string[] | null {
  const g = (gouts ?? []).map((x) => x.trim()).filter(Boolean);
  if (g.length === 0) return null;
  if (g.length === 1) return [collerEtiquette('GOÛT :', g[0].toUpperCase())];
  return g.map((x, i) => collerEtiquette(`ÉTAGE ${i + 1} :`, x.toUpperCase()));
}

/**
 * Number Cake sur le bon (propriétaire, 28/10/2026 : « chiffres ou lettres »
 * partout, « formes » prêtait à confusion avec carré / rond) :
 * « CHIFFRES OU LETTRES : 2  5 », double espace conservé. null sans valeur.
 */
export function chiffresOuLettresAImprimer(formes: string | null | undefined): string | null {
  const t = formesAImprimer(formes);
  return t ? collerEtiquette('CHIFFRES OU LETTRES :', t) : null;
}

/**
 * Formes d'un Number Cake, lisibles d'un coup d'œil (propriétaire, 22/10/2026) :
 * chiffres et lettres espacés et en capitales, « 25 » → « 2  5 », « am » →
 * « A  M ». Une autre forme (« cœur + 1 ») reste telle qu'écrite.
 */
export function formesAImprimer(formes: string | null | undefined): string | null {
  const t = String(formes ?? '').trim();
  if (!t) return null;
  if (/^[\p{L}\p{N}]+$/u.test(t)) return [...t.toUpperCase()].join('  ');
  return t;
}

/**
 * Forme d'un gâteau sur commande (R63, propriétaire, 26/10/2026), en capitales
 * pour l'atelier : « FORME : CARRÉ » / « FORME : ROND », libellés du domaine
 * (`LIBELLES_FORME`). À ne pas confondre avec `formes` (Number Cake).
 * Une valeur inconnue (refusée par la base, donc anormale) s'imprime telle
 * quelle plutôt que de disparaître : une forme ne doit jamais se perdre en route.
 */
export function formeAImprimer(forme: unknown): string | null {
  const t = typeof forme === 'string' ? forme.trim() : '';
  if (!t) return null;
  const libelle = t === 'carre' || t === 'rond' ? LIBELLES_FORME[t] : t;
  return `FORME : ${libelle.toUpperCase()}`;
}

/**
 * Lit la forme d'une ligne. Le type d'affichage `LigneCommande` ne porte pas
 * encore le champ (dépendance signalée à `commandes-traiteur`) ; la valeur,
 * elle, arrive déjà avec la ligne Prisma renvoyée par l'API.
 */
export function formeDeLigne(ligne: object): string | null {
  return formeAImprimer((ligne as { forme?: unknown }).forme);
}

/**
 * Photo modèle choisie dans la galerie (propriétaire, 26/10/2026) : le bon ne
 * porte que le code, « Photo sélectionnée : G043 » (imprimante monochrome :
 * jamais l'image). Rien sans photo (aucun champ vide imprimé). À ne pas
 * confondre avec `photoWhatsapp` / `photoImprimee` de la commande.
 */
export function photoModeleAImprimer(code: unknown): string | null {
  const t = typeof code === 'string' ? code.trim() : '';
  return t ? `Photo sélectionnée : ${t}` : null;
}

/**
 * Lit la photo modèle d'une ligne. Comme `formeDeLigne` : le type d'affichage
 * `LigneCommande` ne porte pas encore `photoModele` (en cours chez
 * `commandes-traiteur`) ; la valeur arrive avec la ligne Prisma de l'API.
 */
export function photoModeleDeLigne(ligne: object): string | null {
  return photoModeleAImprimer((ligne as { photoModele?: unknown }).photoModele);
}

/** Bases de prix connues (`BasePrix` du catalogue). */
const BASES_PRIX = ['piece', 'kg', 'personne', 'forfait'] as const;
type BaseLigne = (typeof BASES_PRIX)[number];

/**
 * Base de prix de la ligne (pièce, kilo, personne, forfait), lue dans les
 * DONNÉES, jamais dans le nom (LOI 6) :
 *   1. la base de la version de tarif appliquée, si l'API la transmet avec la
 *      ligne (`prixProduit.basePrix`, ou `basePrix` à plat) ;
 *   2. sinon, pour un supplément, la base DÉCLARÉE au catalogue
 *      (`baseDuSupplement`, table explicite de familles.ts) ;
 *   3. sinon null : inconnue.
 */
export function basePrixDeLigne(ligne: LigneCommande): BaseLigne | null {
  if (ligne.unite === 'kg') return 'kg';
  const brute = ligne as { basePrix?: unknown; prixProduit?: { basePrix?: unknown } | null };
  const transmise = brute.prixProduit?.basePrix ?? brute.basePrix;
  if (typeof transmise === 'string' && (BASES_PRIX as readonly string[]).includes(transmise)) {
    return transmise as BaseLigne;
  }
  const p = ligne.produitCatalogue;
  if (p?.categorie && p.nom && p.regimePrix) {
    return baseDuSupplement(p.regimePrix === 'A' ? 'comptoir' : 'sur-commande', p.categorie, p.nom);
  }
  return null;
}

/** Supplément déclaré au catalogue (Pâte à sucre, Photo, Écriture), lu dans la table, jamais dans le nom. */
function estLigneSupplement(ligne: LigneCommande): boolean {
  const p = ligne.produitCatalogue;
  if (!p?.categorie || !p.nom || !p.regimePrix) return false;
  return familleDuProduit(p.regimePrix === 'A' ? 'comptoir' : 'sur-commande', p.categorie, p.nom) === 'supplement';
}

/**
 * Comment s'imprime la quantité (propriétaire, 28/10/2026) :
 *   « 10 × » à la pièce · « 0,750 kg » au kilo, sans « × » orphelin ·
 *   « 1 gâteau — 20 PARTS » pour un gâteau vendu par personne ·
 *   « Pâte à sucre — 20 parts » pour un supplément par personne.
 * Base inconnue (l'API ne la transmet pas) : « N × », l'impression d'avant —
 * on ne devine jamais le régime d'après le nom.
 */
export function lectureQuantite(
  ligne: LigneCommande
): 'piece' | 'kg' | 'gateau-par-personne' | 'supplement-par-personne' {
  const base = basePrixDeLigne(ligne);
  if (base === 'kg') return 'kg';
  if (base === 'personne') return estLigneSupplement(ligne) ? 'supplement-par-personne' : 'gateau-par-personne';
  return 'piece';
}

/** « FORME : CARRÉ » → étiquette collée à sa valeur par des insécables. */
function collerApresDeuxPoints(texte: string | null): string | null {
  if (!texte) return null;
  const i = texte.indexOf(' : ');
  return i < 0 ? texte : collerEtiquette(`${texte.slice(0, i)} :`, texte.slice(i + 3));
}

/**
 * Formate une ligne : le total passe par `totalLigne` (domaine), jamais par
 * une multiplication locale — au kilo, la quantité est en grammes et le prix
 * au kilo ; une multiplication nue imprimerait mille fois le bon montant.
 */
export function formaterLigneTicket(ligne: LigneCommande, destination: Destination): LigneTicket {
  // Les lignes antérieures au lot 2 n'ont pas d'unité : elles étaient toutes
  // à la pièce (même défaut qu'en base).
  const unite = ligne.unite ?? 'piece';
  const total = totalLigne(unite, ligne.quantite, ligne.prixCentimes);
  const lecture = lectureQuantite(ligne);
  const parts = formaterQuantite('piece', ligne.quantite);
  return {
    quantite:
      lecture === 'kg'
        ? formaterQuantite('kg', ligne.quantite)
        : lecture === 'piece'
          ? `${formaterQuantite('piece', ligne.quantite)} ×`
          : '',
    libelle: ligne.libelle,
    complementLibelle: lecture === 'supplement-par-personne' ? `—${INSECABLE}${parts}${INSECABLE}parts` : null,
    parts: lecture === 'gateau-par-personne' ? ['1', 'gâteau', '—', parts, 'PARTS'].join(INSECABLE) : null,
    // Prix unitaire FIGÉ sur la ligne (prixCentimes), seulement formaté : le
    // bon montre « 20 PARTS · … € par personne », jamais un total nu.
    prixUnitaire: lecture === 'piece' || lecture === 'kg' ? null : `${formaterEuros(ligne.prixCentimes)} par personne`,
    precision: ligne.precision?.trim() || null,
    formes: chiffresOuLettresAImprimer(ligne.formes),
    forme: collerApresDeuxPoints(formeDeLigne(ligne)),
    photoModele: collerApresDeuxPoints(photoModeleDeLigne(ligne)),
    gouts: goutsLignesAImprimer(ligne.gouts),
    decorations: ligne.decorations?.length ? collerEtiquette('Déco :', ligne.decorations.join(', ')) : null,
    // Un total incalculable ne s'imprime jamais comme un montant : on préfère
    // un trou visible à un chiffre faux sur un bon remis au client.
    prix: total.ok ? formaterEuros(total.donnees) : 'à confirmer',
    aConfirmer: Boolean(ligne.ligneLibreAutoriseePar) && estExemplaireInterne(destination),
  };
}

/**
 * Consignes d'atelier d'une ligne, dans l'ordre de lecture du pâtissier —
 * même ordre sur les trois rendus (Star, ticket navigateur, A6) :
 * chiffres ou lettres, goût(s) (un étage par ligne), forme, photo modèle,
 * décoration, précision. Toutes en gras : en maigre, elles se perdaient.
 */
export function consignesDeLigne(ligne: LigneTicket): Consigne[] {
  const c: Consigne[] = [];
  if (ligne.formes) c.push({ texte: ligne.formes, grand: true });
  for (const g of ligne.gouts ?? []) c.push({ texte: g });
  if (ligne.forme) c.push({ texte: ligne.forme });
  if (ligne.photoModele) c.push({ texte: ligne.photoModele });
  if (ligne.decorations) c.push({ texte: ligne.decorations });
  if (ligne.precision) c.push({ texte: ligne.precision });
  return c;
}

/**
 * « à 14h30 », ou null si l'heure de retrait n'a pas été fixée (facultative).
 * L'heure est stockée « 14:30 » (champ horaire) : elle s'imprime « 14h30 »,
 * comme sur les affiches. Une valeur illisible s'imprime telle quelle plutôt
 * que de disparaître — une heure de retrait ne doit jamais se perdre en route.
 */
export function mentionHeureRetrait(heure: string | null | undefined): string | null {
  const propre = (heure ?? '').trim();
  if (!propre) return null;
  const minutes = lireHeure(propre);
  return `à ${minutes === null ? propre : formaterHeure(minutes)}`;
}

/**
 * La date de retrait en toutes lettres et en capitales (demande du
 * propriétaire du 19/10/2026) : « SAMEDI 24 OCTOBRE 2026 », et sa forme
 * courte « SAMEDI 24/10 » quand la place manque. Le nom du jour vient du
 * domaine (`nomJour`), jamais d'une liste écrite ici.
 */
export function dateRetraitTicket(date: string): { longue: string; courte: string } {
  const iso = date.slice(0, 10);
  const [a, m, j] = iso.split('-');
  const jour = nomJour(iso).toUpperCase();
  const mois = new Intl.DateTimeFormat('fr-BE', { month: 'long', timeZone: 'UTC' })
    .format(new Date(`${iso}T00:00:00Z`))
    .toUpperCase();
  const quantieme = Number(j) === 1 ? '1ER' : String(Number(j));
  return { longue: `${jour} ${quantieme} ${mois} ${a}`, courte: `${jour} ${j}/${m}` };
}

/**
 * Découpe un texte en lignes qui tiennent dans `largeurMax`, toujours entre
 * deux mots. Un mot seul plus large que la colonne (rare : libellé collé par
 * des tirets) est coupé en dernier recours après un trait d'union s'il en a
 * un, sinon au caractère — plutôt que de déborder hors du papier.
 * `mesurer` est injecté : le canvas en vrai, une approximation dans les tests.
 */
export function couperTexte(texte: string, largeurMax: number, mesurer: (s: string) => number): string[] {
  // Coupe sur les espaces ordinaires SEULEMENT : une insécable (étiquette
  // « ÉTAGE 1 : » collée à son goût) ne se coupe jamais. Les espaces entre
  // deux mots sont conservés tels quels (Number Cake « 2  5 », propriétaire
  // 22/10/2026) ; tabulation et retour à la ligne valent une espace.
  const morceaux = texte.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '').split(/([ \t\r\n]+)/);
  const lignes: string[] = [];
  let courante = '';
  for (let i = 0; i < morceaux.length; i += 2) {
    const mot = morceaux[i];
    if (!mot) continue;
    const brut = i > 0 ? morceaux[i - 1] : '';
    const separateur = /[\t\r\n]/.test(brut) ? ' ' : brut;
    scinderMot(mot, largeurMax, mesurer).forEach((morceau, k) => {
      const essai = courante ? `${courante}${k === 0 ? separateur : ''}${morceau}` : morceau;
      if (!courante || mesurer(essai) <= largeurMax) {
        courante = essai;
      } else {
        lignes.push(courante);
        courante = morceau;
      }
    });
  }
  if (courante) lignes.push(courante);
  return lignes.length ? lignes : [''];
}

/** Regroupe des morceaux tant qu'ils tiennent dans la largeur. */
function regrouper(morceaux: string[], largeurMax: number, mesurer: (s: string) => number): string[] {
  const sortie: string[] = [];
  let courant = '';
  for (const morceau of morceaux) {
    if (courant && mesurer(courant + morceau) > largeurMax) {
      sortie.push(courant);
      courant = morceau;
    } else {
      courant += morceau;
    }
  }
  if (courant) sortie.push(courant);
  return sortie;
}

function scinderMot(mot: string, largeurMax: number, mesurer: (s: string) => number): string[] {
  if (mesurer(mot) <= largeurMax) return [mot];
  // D'abord après les traits d'union existants (« Mini-sandwichs » → « Mini- » « sandwichs »).
  const parties = mot.split(/(?<=-)/);
  return regrouper(parties, largeurMax, mesurer).flatMap((m) =>
    mesurer(m) <= largeurMax ? [m] : regrouper(Array.from(m), largeurMax, mesurer)
  );
}

/** Corps des lignes de produits : +27 % par rapport à l'ancien 22 points (demande du 19/10/2026). */
export const TAILLE_PRODUIT = 28;
/** En dessous, un libellé se lit mal sur un feuillet accroché : on coupe plutôt. */
const TAILLE_PRODUIT_MIN = 22;

/**
 * Les mentions « à confirmer » sont internes : le client qui vient de verser
 * un acompte n'a pas à lire que sa commande n'est pas sûre. Règle unique pour
 * le ticket réseau (canvas) et le ticket navigateur (TicketCommande).
 */
export function estExemplaireInterne(destination: Destination): boolean {
  return destination !== 'CLIENT';
}

/** Demande à confirmer (exemplaires internes seulement) : champ du lot 2, ou ancien drapeau en repli. */
export function demandeAConfirmer(
  commande: Pick<Commande, 'demandeInhabituelle' | 'gateauComplexe'>,
  destination: Destination
): boolean {
  return Boolean(commande.demandeInhabituelle || commande.gateauComplexe) && estExemplaireInterne(destination);
}

/**
 * Zone « dessin, précisions » : seulement si le vendeur l'a demandée sur la
 * commande (décision du propriétaire, 21/10/2026), et jamais sur l'exemplaire
 * CLIENT. Règle unique pour les trois rendus (canvas, ticket navigateur, A6).
 * Ancienne commande sans le champ : pas de zone.
 */
export function zoneDessinImprimee(commande: Pick<Commande, 'zoneDessin'>, destination: Destination): boolean {
  return commande.zoneDessin === true && estExemplaireInterne(destination);
}

/* --------------------------------------------------------------- Outils */

/**
 * Le dessin se fait en deux passes : une pour mesurer, une pour tracer. Sans
 * ça il faudrait deviner la hauteur du canvas avant de connaître le nombre de
 * lignes que prendra un libellé une fois coupé, et une commande de vingt
 * produits déborderait en silence — exactement le défaut qu'on vient de
 * corriger sur la version papier.
 */
class Plume {
  y = MARGE;
  // Propriétés déclarées à la main (pas de « parameter properties ») : le
  // module doit se charger sous `node --test`, qui ne fait que retirer les types.
  readonly ctx: Contexte | null;
  largeur: number;
  constructor(ctx: Contexte | null, largeur = LARGEUR) {
    this.ctx = ctx;
    this.largeur = largeur;
  }

  private avec(police: string, action: (ctx: Contexte) => void) {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.font = police;
    this.ctx.fillStyle = '#000';
    this.ctx.strokeStyle = '#000';
    this.ctx.textBaseline = 'top';
    action(this.ctx);
    this.ctx.restore();
  }

  /** Découpe un texte pour qu'il tienne dans une largeur donnée (voir couperTexte). */
  private couper(texte: string, police: string, largeurMax: number): string[] {
    const ctx = this.ctx;
    if (!ctx) {
      // Passe sans contexte : approximation par le nombre de caractères.
      // Jamais utilisée en pratique — on mesure toujours avec un canvas.
      return couperTexte(texte, largeurMax, (s) => s.length * 9);
    }
    ctx.save();
    ctx.font = police;
    const lignes = couperTexte(texte, largeurMax, (s) => ctx.measureText(s).width);
    ctx.restore();
    return lignes;
  }

  /** Largeur d'un texte dans une police donnée (approximation sans canvas). */
  mesurer(texte: string, taille: number, gras = false): number {
    if (!this.ctx) return texte.length * taille * 0.6;
    this.ctx.save();
    this.ctx.font = `${gras ? '700 ' : ''}${taille}px ${SANS}`;
    const largeur = this.ctx.measureText(texte).width;
    this.ctx.restore();
    return largeur;
  }

  texte(
    contenu: string,
    options: {
      taille?: number;
      gras?: boolean;
      align?: 'gauche' | 'centre' | 'droite';
      interligne?: number;
      x?: number;
      largeurMax?: number;
      espacement?: number;
    } = {}
  ) {
    const taille = options.taille ?? 22;
    const police = `${options.gras ? '700 ' : ''}${taille}px ${SANS}`;
    const largeurMax = options.largeurMax ?? UTILE;
    const interligne = options.interligne ?? Math.round(taille * 1.25);
    const lignes = this.couper(contenu, police, largeurMax);
    for (const ligne of lignes) {
      this.avec(police, (ctx) => {
        let x = options.x ?? MARGE;
        if (options.align === 'centre') {
          x = (this.largeur - ctx.measureText(ligne).width) / 2;
        } else if (options.align === 'droite') {
          x = MARGE + largeurMax - ctx.measureText(ligne).width;
        }
        ctx.fillText(ligne, x, this.y);
      });
      this.y += interligne;
    }
  }

  /** Une étiquette en petites capitales, comme sur le bon papier. */
  etiquette(contenu: string) {
    this.texte(contenu.toUpperCase(), { taille: 15, gras: true, interligne: 19 });
  }

  /**
   * Destination (CLIENT, BUREAU…) : très grand, en gras, noir sur blanc — plus
   * d'aplat noir (22/10/2026) : une imprimante thermique ralentit sur les grandes
   * zones noires, et elles usent la tête. Il se lit toujours à un mètre.
   */
  bandeau(contenu: string) {
    const hauteur = 60;
    if (this.ctx) {
      this.ctx.save();
      this.ctx.fillStyle = '#000';
      this.ctx.font = `800 50px ${SANS}`;
      this.ctx.textBaseline = 'middle';
      const espace = contenu.split('').join(' ');
      const l = this.ctx.measureText(espace).width;
      this.ctx.fillText(espace, (this.largeur - l) / 2, this.y + hauteur / 2 + 1);
      this.ctx.restore();
    }
    this.y += hauteur;
  }

  trait(epaisseur = 2, pointille = false) {
    if (this.ctx) {
      this.ctx.save();
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = epaisseur;
      if (pointille) this.ctx.setLineDash([4, 5]);
      this.ctx.beginPath();
      this.ctx.moveTo(MARGE, this.y + epaisseur / 2);
      this.ctx.lineTo(LARGEUR - MARGE, this.y + epaisseur / 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
    this.y += epaisseur;
  }

  /**
   * Encadre une zone déjà dessinée. Le haut est passé explicitement : se fier
   * à la position courante revient à encadrer le bloc suivant, ce qui ne se
   * voit qu'à l'impression.
   */
  cadre(haut: number, bas: number, epaisseur = 3, pointille = false) {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = epaisseur;
    if (pointille) this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(MARGE, haut, UTILE, bas - haut);
    this.ctx.restore();
  }

  espace(points: number) {
    this.y += points;
  }
}

/* ------------------------------------------------- Le dessin d'un ticket */

function dessiner(plume: Plume, destination: Destination, commande: Commande) {
  const pourLeClient = destination === 'CLIENT';
  const reste = Math.max(0, commande.totalCentimes - commande.acompteCentimes);

  plume.texte('PAin PAtisserie', { taille: 40, gras: true, align: 'centre' });
  plume.espace(4);
  // Gras et 19 points (22/10/2026) : en 17 points maigre, les traits fins sortaient
  // hachés sur le ticket noir et blanc (même cas que « À présenter au retrait »).
  plume.texte('Chaussée de Louvain 906 — 1140 Evere', { taille: 19, gras: true, align: 'centre', interligne: 24 });
  plume.texte('+32 472 25 05 78', { taille: 19, gras: true, align: 'centre', interligne: 24 });
  plume.espace(8);
  plume.trait(3);
  plume.espace(10);

  plume.bandeau(destination);
  plume.espace(14);

  // Nouvelle version d'une commande déjà imprimée : l'atelier doit jeter l'ancien ticket.
  const modification = bandeauModification(commande, destination);
  if (modification) {
    if (!modification.consigne) {
      plume.texte(modification.titre, { taille: 18, gras: true, align: 'centre', interligne: 24 });
      plume.espace(8);
    } else {
      const haut = plume.y;
      plume.espace(10);
      plume.texte(modification.titre, { taille: 28, gras: true, align: 'centre', interligne: 34 });
      plume.texte(modification.consigne, { taille: 22, gras: true, align: 'centre', interligne: 28 });
      plume.espace(8);
      plume.cadre(haut, plume.y, 5);
      plume.espace(14);
    }
  }

  // Numéro : toujours présent (communication du virement, recherche dans
  // l'application), mais en petit depuis le 19/10/2026 — la place va au
  // retrait et aux produits, qu'on lit de loin.
  plume.texte(`Commande n° ${commande.numero}`, { taille: 18, gras: true, interligne: 23 });
  const prise = formaterDate(commande.priseLe);
  plume.texte(
    pourLeClient ? `Prise le ${prise}` : `Prise le ${prise}${commande.vendeur ? ` · ${commande.vendeur}` : ''}`,
    { taille: 17, gras: true, interligne: 21 }
  );
  plume.espace(12);

  champ(plume, 'Nom', commande.client);
  champ(plume, 'Téléphone', commande.telephone);
  plume.espace(12);

  // Le retrait encadré : c'est l'information qu'on cherche du regard sur un
  // feuillet accroché parmi trente autres.
  const hautRetrait = plume.y;
  plume.espace(10);
  plume.texte('POUR LE', { taille: 16, gras: true, align: 'centre', interligne: 22 });
  // « SAMEDI 24 OCTOBRE 2026 » si ça tient sur une ligne, sinon « MERCREDI 30/09 » :
  // la date se lit d'un coup d'œil, jamais coupée en deux.
  const date = dateRetraitTicket(commande.retraitLe);
  const largeurCadre = UTILE - 20;
  plume.texte(plume.mesurer(date.longue, 34, true) <= largeurCadre ? date.longue : date.courte, {
    taille: 34,
    gras: true,
    align: 'centre',
    interligne: 40,
    largeurMax: largeurCadre,
  });
  const heure = mentionHeureRetrait(commande.retraitHeure);
  if (heure) plume.texte(heure, { taille: 34, gras: true, align: 'centre', interligne: 40 });
  plume.espace(10);
  plume.cadre(hautRetrait, plume.y, 4);
  plume.espace(16);

  plume.etiquette('Produits commandés');
  plume.espace(2);
  plume.trait(3);
  plume.espace(6);
  // Une quantité au kilo (« 0,750 kg ») est plus large que « 12 × » : la
  // colonne s'élargit pour tout le ticket, pour garder les libellés alignés.
  // Les colonnes sont mesurées sur la plus large des quantités (« 0,750 kg »,
  // « 120 × ») et des prix : les libellés restent alignés sur tout le ticket.
  const lignes = commande.lignes.map((l) => formaterLigneTicket(l, destination));
  const colQuantite = Math.ceil(
    Math.max(48, ...lignes.filter((l) => l.quantite).map((l) => plume.mesurer(l.quantite, TAILLE_PRODUIT, true))) + 10
  );
  const colPrix = Math.ceil(Math.max(100, ...lignes.map((l) => plume.mesurer(l.prix, TAILLE_PRODUIT - 2))) + 8);
  for (const ligne of lignes) {
    produit(plume, ligne, colQuantite, colPrix);
  }
  plume.espace(8);

  if (commande.texteGateau) {
    mention(plume, 'Sur le gâteau', commande.texteGateau);
  }
  // Pas d'écriture : rien d'imprimé, même « sans écriture » demandé (propriétaire, 26/10/2026).
  if (commande.photoImprimee) {
    mention(plume, 'Photo', 'À IMPRIMER SUR LE GÂTEAU');
  }
  // « À confirmer » n'a de sens qu'en interne (voir estExemplaireInterne).
  if (demandeAConfirmer(commande, destination)) {
    mention(plume, 'Demande inhabituelle', 'À CONFIRMER — PRIX ET FAISABILITÉ');
  }
  if (commande.photoWhatsapp && !pourLeClient) {
    mention(plume, 'Modèle', 'Photo d’exemple sur WhatsApp — à réclamer au manager', true);
  }
  if (commande.remarques && !pourLeClient) {
    mention(plume, 'Remarques', commande.remarques, true);
  }

  plume.espace(10);
  montant(plume, 'Total', formaterEuros(commande.totalCentimes), true);
  montant(plume, 'Acompte', formaterEuros(commande.acompteCentimes));
  montant(plume, 'Restant dû', formaterEuros(reste));
  plume.espace(16);

  if (pourLeClient) {
    plume.trait(1, true);
    plume.espace(14);
    // Gras et 20 points (22/10/2026) : en 18 points maigre, les traits fins (accent
    // du « À », courbes de « au ») tombaient au seuil noir/blanc et sortaient hachés.
    plume.texte('À présenter au retrait', { taille: 20, gras: true, align: 'centre', interligne: 27 });
    plume.texte('Merci de votre confiance', { taille: 20, gras: true, align: 'centre', interligne: 27 });
    if (commande.modePaiement === 'virement') {
      plume.texte(`Communication du virement : ${commande.numero}`, {
        taille: 18,
        gras: true,
        align: 'centre',
        interligne: 24,
      });
    }
  } else if (zoneDessinImprimee(commande, destination)) {
    // Demandée sur la commande (client qui veut un dessin, un croquis) :
    // de quoi dessiner le gâteau. Sans demande, le ticket s'arrête ici.
    const haut = plume.y;
    plume.espace(8);
    plume.texte('ZONE LIBRE — DESSIN, PRÉCISIONS', { taille: 15, gras: true, x: MARGE + 10, interligne: 19 });
    plume.y = haut + ZONE_LIBRE;
    plume.cadre(haut, plume.y, 2, true);
  }

  plume.espace(MARGE);
}

function champ(plume: Plume, etiquette: string, valeur: string | null | undefined) {
  // Champ vide : rien d'imprimé, ni étiquette ni tiret (propriétaire, 26/10/2026).
  if (!valeur?.trim()) return;
  plume.texte(etiquette.toUpperCase(), { taille: 15, gras: true, interligne: 0 });
  plume.texte(valeur, {
    taille: 24,
    gras: true,
    align: 'droite',
    interligne: 30,
  });
  plume.espace(4);
  plume.trait(1, true);
  plume.espace(8);
}

/** Retrait des consignes sous le produit : assez pour les rattacher au produit, sans voler la largeur. */
const RETRAIT_CONSIGNE = 12;

function produit(plume: Plume, ligne: LigneTicket, colQuantite: number, colPrix: number) {
  // Prix par personne : pas de colonne quantité (les parts sont dites en
  // dessous), le libellé prend toute la place jusqu'au prix — « Pièce montée
  // 2 étages » tient sur une ligne.
  const decalage = ligne.quantite ? colQuantite : 0;
  const colNom = UTILE - decalage - colPrix - 8;
  const titre = ligne.complementLibelle ? `${ligne.libelle} ${ligne.complementLibelle}` : ligne.libelle;
  const haut = plume.y;
  // Un mot plus large que la colonne réduit d'abord le corps de la ligne
  // (jusqu'à TAILLE_PRODUIT_MIN), avant toute coupure en milieu de mot.
  let taille = TAILLE_PRODUIT;
  const motLePlusLong = (texte: string, t: number) =>
    Math.max(0, ...texte.split(/[ \t\r\n]+/).map((mot) => plume.mesurer(mot, t)));
  while (taille > TAILLE_PRODUIT_MIN && motLePlusLong(titre, taille) > colNom) taille -= 1;
  const interligne = Math.round(taille * 1.2);

  if (ligne.quantite) {
    plume.texte(ligne.quantite, { taille: TAILLE_PRODUIT, gras: true, interligne: 0 });
    plume.y = haut;
  }
  plume.texte(titre, { taille, x: MARGE + decalage, largeurMax: colNom, interligne });
  const basTitre = plume.y;
  // Le prix reste sur la ligne du produit (exemplaires ATELIER compris,
  // propriétaire 28/10/2026) ; les consignes, elles, passent dessous.
  plume.y = haut + 2;
  plume.texte(ligne.prix, { taille: TAILLE_PRODUIT - 2, align: 'droite', interligne: 0 });
  plume.y = Math.max(basTitre, haut + Math.round(TAILLE_PRODUIT * 1.2));

  // Consignes d'atelier : SOUS le produit, sur toute la largeur du papier —
  // plus jamais « GOÛT : MOUSSE / CHOCOLAT » coupé par la colonne des prix.
  const x = MARGE + RETRAIT_CONSIGNE;
  const largeurMax = UTILE - RETRAIT_CONSIGNE;
  if (ligne.parts) plume.texte(ligne.parts, { taille: TAILLE_PRODUIT, gras: true, x, largeurMax, interligne: 34 });
  if (ligne.prixUnitaire) plume.texte(ligne.prixUnitaire, { taille: 20, gras: true, x, largeurMax, interligne: 26 });
  for (const consigne of consignesDeLigne(ligne)) {
    plume.texte(consigne.texte, {
      taille: consigne.grand ? 28 : 24,
      gras: true,
      x,
      largeurMax,
      interligne: consigne.grand ? 34 : 30,
    });
  }
  if (ligne.aConfirmer) {
    plume.texte(MENTION_LIGNE_LIBRE.toUpperCase(), { taille: 18, gras: true, x, largeurMax, interligne: 23 });
  }
  plume.espace(4);
  plume.trait(1, true);
  plume.espace(7);
}

function mention(plume: Plume, etiquette: string, valeur: string, discret = false) {
  const haut = plume.y;
  plume.espace(8);
  plume.texte(etiquette.toUpperCase(), { taille: 14, gras: true, x: MARGE + 10, interligne: 18 });
  plume.texte(valeur, {
    taille: discret ? 19 : 24,
    gras: !discret,
    x: MARGE + 10,
    largeurMax: UTILE - 20,
    interligne: discret ? 24 : 29,
  });
  plume.espace(8);
  plume.cadre(haut, plume.y, discret ? 2 : 3, discret);
  plume.espace(10);
}

function montant(plume: Plume, etiquette: string, valeur: string, inverse = false) {
  const hauteur = 40;
  const ctx = plume.ctx;
  if (ctx) {
    ctx.save();
    if (inverse) {
      // TOTAL : cadre épais au lieu d'un aplat noir (plus rapide à imprimer).
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 5;
      ctx.strokeRect(MARGE + 2.5, plume.y + 2.5, UTILE - 5, hauteur - 5);
      ctx.fillStyle = '#000';
    } else {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeRect(MARGE, plume.y, UTILE, hauteur);
      ctx.fillStyle = '#000';
    }
    ctx.textBaseline = 'middle';
    ctx.font = `700 20px ${SANS}`;
    ctx.fillText(etiquette.toUpperCase(), MARGE + 12, plume.y + hauteur / 2 + 1);
    ctx.font = `700 26px ${SANS}`;
    const l = ctx.measureText(valeur).width;
    ctx.fillText(valeur, LARGEUR - MARGE - 12 - l, plume.y + hauteur / 2 + 1);
    ctx.restore();
  }
  plume.y += hauteur;
}

/* ------------------------------------------------------------- Interface */

/**
 * Dessine un exemplaire sur un contexte fourni et renvoie la hauteur utilisée.
 * Sert aux tests (contexte factice qui enregistre le texte tracé) : on vérifie
 * ainsi le ticket réellement produit, pas une copie de sa logique.
 */
export function dessinerSurContexte(ctx: Contexte | null, destination: Destination, commande: Commande): number {
  const plume = new Plume(ctx);
  dessiner(plume, destination, commande);
  return Math.ceil(plume.y);
}

function nouveauCanvas(largeur: number, hauteur: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = largeur;
  canvas.height = hauteur;
  return canvas;
}

/**
 * Dessine un exemplaire et renvoie le canvas. Deux passes : la première
 * mesure la hauteur réelle, la seconde dessine pour de bon.
 */
export function dessinerTicket(destination: Destination, commande: Commande): HTMLCanvasElement {
  const mesure = nouveauCanvas(LARGEUR, 10);
  const ctxMesure = mesure.getContext('2d');
  const plumeMesure = new Plume(ctxMesure);
  dessiner(plumeMesure, destination, commande);
  const hauteur = Math.ceil(plumeMesure.y);

  const canvas = nouveauCanvas(LARGEUR, hauteur);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, LARGEUR, hauteur);
  }
  dessiner(new Plume(ctx), destination, commande);
  return canvas;
}

/** Le PNG à envoyer à l'imprimante, en base64 sans le préfixe data:. */
export function ticketEnPng(destination: Destination, commande: Commande): string {
  const canvas = dessinerTicket(destination, commande);
  return canvas.toDataURL('image/png').split(',')[1] ?? '';
}

function formaterDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
