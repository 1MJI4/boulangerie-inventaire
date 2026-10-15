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
// HYPOTHÈSE À VALIDER : l'import en PRODUCTION n'est pas couvert par ce lot ;
// il se fera après validation du rapport par le gérant, par une procédure
// `deploiement` (sauvegarde puis import), pas en levant ce garde-fou.

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
