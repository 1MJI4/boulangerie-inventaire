// src/catalogue/gardeEcriture.ts
// Garde-fou de `importer-catalogue.mjs --ecrire-en-base` : n'écrire QUE dans
// une base de recette désignée deux fois, explicitement.
//
//   1. DATABASE_URL porte la marque « recette » dans le nom de la base ou
//      dans le nom d'hôte (ex. …/boulangerie_recette) ;
//   2. ET l'option --je-confirme-la-base=<nom d'hôte> reprend exactement
//      l'hôte de DATABASE_URL.
//
// Les deux conditions sont exigées. Le mot de passe n'apparaît jamais dans
// les messages. Pur, sans accès réseau.
//
// La PRODUCTION a son propre garde-fou (verifierCiblePremierImportProduction) :
// premier import seulement, sur un catalogue vide — il n'y a alors rien à
// écraser ni à sauvegarder. Tout import ultérieur en production (nouveau
// tarif) reste refusé ici : il passera par une procédure `deploiement`
// (sauvegarde puis import), pas en assouplissant ces garde-fous.

export const MARQUE_RECETTE = /recette/i;

export type VerdictCible =
  | { ok: true; hote: string; base: string }
  | { ok: false; message: string };

export function verifierCibleEcriture(databaseUrl: string | undefined, confirmation: string | undefined): VerdictCible {
  if (!databaseUrl) {
    return { ok: false, message: "DATABASE_URL est vide : aucune base désignée, rien n'est écrit." };
  }
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return { ok: false, message: "DATABASE_URL est illisible : rien n'est écrit." };
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    return { ok: false, message: "DATABASE_URL ne désigne pas une base PostgreSQL : rien n'est écrit." };
  }
  const hote = url.hostname.toLowerCase();
  const base = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!hote || !base) {
    return { ok: false, message: "DATABASE_URL sans hôte ou sans nom de base : rien n'est écrit." };
  }
  if (!MARQUE_RECETTE.test(base) && !MARQUE_RECETTE.test(hote)) {
    return {
      ok: false,
      message: `La base « ${base} » sur « ${hote} » ne porte pas la marque « recette » : écriture refusée (garde-fou contre la production). Rien n'est écrit.`,
    };
  }
  if (!confirmation) {
    return {
      ok: false,
      message: `Confirmation manquante : relancer avec --je-confirme-la-base=${hote} si c'est bien la base de recette visée. Rien n'est écrit.`,
    };
  }
  if (confirmation.trim().toLowerCase() !== hote) {
    return {
      ok: false,
      message: `L'hôte confirmé « ${confirmation} » ne correspond pas à l'hôte de DATABASE_URL « ${hote} » : écriture refusée. Rien n'est écrit.`,
    };
  }
  return { ok: true, hote, base };
}

/**
 * Premier import du catalogue en PRODUCTION (option --production).
 *  1. l'hôte est confirmé par --je-confirme-la-base=<hôte>, exactement ;
 *  2. la base ne porte PAS la marque « recette » (l'option ne sert pas à
 *     contourner le garde-fou de recette, ni l'inverse) ;
 *  3. le catalogue de commande en base est VIDE (aucun ProduitCatalogue).
 * Pur : le nombre de produits déjà en base est lu par l'appelant.
 */
export function verifierCiblePremierImportProduction(
  databaseUrl: string | undefined,
  confirmation: string | undefined,
  produitsCatalogueEnBase: number,
): VerdictCible {
  if (!databaseUrl) {
    return { ok: false, message: "DATABASE_URL est vide : aucune base désignée, rien n'est écrit." };
  }
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return { ok: false, message: "DATABASE_URL est illisible : rien n'est écrit." };
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    return { ok: false, message: "DATABASE_URL ne désigne pas une base PostgreSQL : rien n'est écrit." };
  }
  const hote = url.hostname.toLowerCase();
  const base = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!hote || !base) {
    return { ok: false, message: "DATABASE_URL sans hôte ou sans nom de base : rien n'est écrit." };
  }
  if (MARQUE_RECETTE.test(base) || MARQUE_RECETTE.test(hote)) {
    return {
      ok: false,
      message: `La base « ${base} » sur « ${hote} » est une base de recette : relancer sans --production. Rien n'est écrit.`,
    };
  }
  if (!confirmation || confirmation.trim().toLowerCase() !== hote) {
    return {
      ok: false,
      message: `Confirmation manquante ou différente : relancer avec --je-confirme-la-base=${hote} si c'est bien la production visée. Rien n'est écrit.`,
    };
  }
  if (!Number.isInteger(produitsCatalogueEnBase) || produitsCatalogueEnBase !== 0) {
    return {
      ok: false,
      message: `Le catalogue de production contient déjà ${produitsCatalogueEnBase} produit(s) : pour un nouveau tarif, faire une sauvegarde vérifiée puis relancer avec --mise-a-jour --sauvegarde-verifiee. Rien n'est écrit.`,
    };
  }
  return { ok: true, hote, base };
}

/**
 * Nouvelle version de tarif sur une production DÉJÀ remplie (26/10/2026,
 * Pâte à sucre). Mêmes garde-fous que le premier import (pas de recette, hôte
 * confirmé), plus : catalogue non vide et sauvegarde vérifiée déclarée. Les
 * anciennes versions ne sont jamais écrasées : `ecrireCatalogueEnBase` ferme
 * l'ancien prix et ajoute le nouveau (LOI 1, catalogue versionné).
 */
export function verifierCibleMiseAJourProduction(
  databaseUrl: string | undefined,
  confirmation: string | undefined,
  produitsCatalogueEnBase: number,
  sauvegardeVerifiee: boolean,
): VerdictCible {
  const cible = verifierCiblePremierImportProduction(databaseUrl, confirmation, 0);
  if (!cible.ok) return cible;
  if (!Number.isInteger(produitsCatalogueEnBase) || produitsCatalogueEnBase <= 0) {
    return {
      ok: false,
      message: "Le catalogue de production est vide : c'est un premier import, relancer sans --mise-a-jour. Rien n'est écrit.",
    };
  }
  if (!sauvegardeVerifiee) {
    return {
      ok: false,
      message:
        "Faire d'abord une sauvegarde vérifiée (sudo systemctl start pain-sauvegarde, DERNIERE-VERIFICATION = OK), puis relancer avec --sauvegarde-verifiee. Rien n'est écrit.",
    };
  }
  return cible;
}
