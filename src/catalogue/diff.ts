// src/catalogue/diff.ts
// Rapport de diff entre deux versions d'une même grille, lisible par le gérant.
// Un produit disparu n'est jamais supprimé : il reste lisible dans les
// inventaires et commandes passés (getProduit) et n'a simplement plus de prix
// dans le nouveau tarif.

import { centimesEnTexte } from "./normaliser.ts";
import type { Catalogue, VersionTarif } from "./types.ts";

export interface DiffTarif {
  inchanges: string[];
  modifies: { id: string; ancienCents: number; nouveauCents: number }[];
  ajoutes: string[];
  disparus: string[];
}

export function comparerVersions(ancienne: VersionTarif | null, nouvelle: VersionTarif): DiffTarif {
  const diff: DiffTarif = { inchanges: [], modifies: [], ajoutes: [], disparus: [] };
  const avant = ancienne?.lignes ?? new Map();
  for (const [id, ligne] of nouvelle.lignes) {
    const a = avant.get(id);
    if (!a) diff.ajoutes.push(id);
    else if (a.prixCentimes !== ligne.prixCentimes) diff.modifies.push({ id, ancienCents: a.prixCentimes, nouveauCents: ligne.prixCentimes });
    else diff.inchanges.push(id);
  }
  for (const id of avant.keys()) if (!nouvelle.lignes.has(id)) diff.disparus.push(id);
  return diff;
}

export function formaterRapportDiff(diff: DiffTarif, catalogue: Catalogue): string {
  const nom = (id: string) => {
    const p = catalogue.produits.get(id);
    return p ? `${p.produit}${p.sousCategorie ? " — " + p.sousCategorie : ""} (${p.categorie})` : id;
  };
  const lignes = [
    `${diff.inchanges.length} produits inchangés · ${diff.modifies.length} prix modifiés · ${diff.ajoutes.length} ajoutés · ${diff.disparus.length} disparus`,
  ];
  if (diff.modifies.length) {
    lignes.push("", "Prix modifiés :");
    for (const m of diff.modifies) lignes.push(`  - ${nom(m.id)} : ${centimesEnTexte(m.ancienCents)} → ${centimesEnTexte(m.nouveauCents)}`);
  }
  if (diff.ajoutes.length) {
    lignes.push("", "Ajoutés :");
    for (const id of diff.ajoutes) lignes.push(`  - ${nom(id)}`);
  }
  if (diff.disparus.length) {
    lignes.push("", "Disparus (conservés dans l'historique, plus vendus à ce tarif) :");
    for (const id of diff.disparus) lignes.push(`  - ${nom(id)}`);
  }
  return lignes.join("\n");
}
