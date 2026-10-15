// src/catalogue/normaliser.ts
// Identifiants, clés de comparaison, lecture de montants — sans flottant.

import type { DateISO } from "./types.ts";

/** Caractères invisibles rencontrés dans l'Excel (ex. « CRABE‭ | ‬SURIMI »). */
const INVISIBLES = /[​-‏‪-‮⁠-⁤﻿]/g;

export function contientInvisibles(texte: string): boolean {
  return new RegExp(INVISIBLES.source).test(texte);
}

/**
 * Slug insensible aux majuscules, aux accents, aux espaces multiples et aux
 * caractères invisibles. Sert à construire l'identifiant, jamais à afficher.
 */
export function slug(texte: string): string {
  return texte
    .replace(INVISIBLES, "")
    .replace(/œ/g, "oe").replace(/Œ/g, "OE").replace(/æ/g, "ae").replace(/Æ/g, "AE")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Identifiant stable « categorie/produit/sous_categorie » (partie vide omise). */
export function identifiantProduit(categorie: string, produit: string, sousCategorie: string): string {
  return [categorie, produit, sousCategorie].map(slug).filter((s) => s !== "").join("/");
}

/**
 * Clé STRICTE de rapprochement (favori ↔ jumeau) : seuls les majuscules et les
 * espaces multiples sont ignorés. Les accents comptent : « Eclair » ≠ « Éclair ».
 */
export function cleStricte(texte: string): string {
  return texte.trim().replace(/\s+/g, " ").toLowerCase();
}

/** true si le libellé a des espaces en trop (début, fin, doubles). */
export function aDesEspacesSuspects(texte: string): boolean {
  return texte !== texte.trim() || /\s{2,}/.test(texte);
}

/**
 * Lit un montant écrit en euros (« 1.3 », « 27 », « 2,80 ») en centimes,
 * par manipulation de chaîne : aucune arithmétique à virgule.
 * Retourne null si le texte n'est pas un montant valide.
 */
export function eurosTexteEnCentimes(texte: string): number | null {
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(texte.trim());
  if (!m) return null;
  const chiffres = m[1] + (m[2] ?? "").padEnd(2, "0");
  return Number.parseInt(chiffres, 10);
}

/** Entier strict positif écrit en chiffres seulement (« 130 »). */
export function lireCentimes(texte: string): number | null {
  const t = texte.trim();
  if (!/^\d+$/.test(t)) return null;
  return Number.parseInt(t, 10);
}

/**
 * Affichage des montants DANS LES RAPPORTS du catalogue uniquement.
 * DÉPENDANCE `regles-metier` : remplacer par `formaterEuros` de
 * src/domaine/argent.ts dès qu'il existe.
 */
export function centimesEnTexte(centimes: number): string {
  const s = String(centimes).padStart(3, "0");
  return `${s.slice(0, -2)},${s.slice(-2)} €`;
}

// ------------------------------------------------------------------ Dates

const FORMAT_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function estDateISO(texte: unknown): texte is DateISO {
  if (typeof texte !== "string") return false;
  const m = FORMAT_DATE.exec(texte);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === texte;
}

/** Jour civil précédent (calendaire — sert seulement à fermer une version). */
export function veille(date: DateISO): DateISO {
  const [a, m, j] = date.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j - 1)).toISOString().slice(0, 10);
}

/** « 2026-09-01 » → « 01/09/2026 » pour les messages. */
export function dateEnTexte(date: DateISO): string {
  const [a, m, j] = date.split("-");
  return `${j}/${m}/${a}`;
}
