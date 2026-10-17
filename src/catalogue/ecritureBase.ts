// src/catalogue/ecritureBase.ts
// Écriture d'une version complète du catalogue dans les tables
// ProduitCatalogue / PrixProduit (JAMAIS « Produit », réservée à l'inventaire).
// Propriétaire : `catalogue-prix`. Appelé par
// scripts/importer-catalogue.mjs --ecrire-en-base.
//
// Aucun import de Prisma ici : la base est atteinte par un
// `ClientEcritureCatalogue` reçu en paramètre (implémenté avec Prisma dans
// ./serveur.ts, par un faux en mémoire dans les tests).
//
// Principe : on calcule d'abord un PLAN (fonction pure) en comparant ce que
// les fichiers décrivent à ce que la base contient, puis on l'applique dans
// UNE transaction. Relancer l'import sur une base à jour donne un plan vide :
// l'écriture est idempotente.
//
// Procédure imposée par le déclencheur PrixProduit_controler (migration
// 20261015110000) : un nouveau prix ne remplace jamais l'ancien.
//   1. fermer la version courante : valideAu = veille de la nouvelle date
//   2. insérer la nouvelle version : valideDu = nouvelle date, valideAu NULL
// Une version déjà en vigueur n'est JAMAIS modifiée (prix, base, seuils) ni
// supprimée. Si la base contient une version que les fichiers ne décrivent
// pas, ou qui diffère, l'import est REFUSÉ en entier (rien n'est écrit) :
// c'est au gérant de trancher, pas au script.
//
// Textes du rapport : catalogue unique des messages, via ./rapport.ts.

import { dateEnTexte, veille } from "./normaliser.ts";
import { dateBaseVersIso, dateIsoVersBase, type ProduitAvecPrixBase } from "./lectureBase.ts";
import { entreeRapport, type CodeRapport } from "./rapport.ts";
import type { BasePrix, Catalogue, DateISO, RegimePrix, Signalement, Unite } from "./types.ts";

// ------------------------------------------------------------ Ce que décrivent les fichiers

export interface PrixAttendu {
  valideDu: DateISO;
  valideAu: DateISO | null;
  prixCentimes: number;
  basePrix: BasePrix;
  minimum: number | null;
  minimumParSymbole: number | null;
  maximum: number | null;
  versionCode: string;
  source: string;
}

export interface ProduitAttendu {
  cle: string;
  /** Libellés À LA LETTRE (LOI 5). */
  nom: string;
  categorie: string;
  /** "" dans le fichier → NULL en base. */
  sousCategorie: string | null;
  unite: Unite;
  regimePrix: RegimePrix;
  estFavori: boolean;
  /**
   * Nombre d'étages indiqué sur l'affiche (gâteau de mariage, pièce montée),
   * null sinon. Lu dans la DERNIÈRE version de la grille qui décrit le produit.
   * Sert au délai « gâteau à étages » (src/domaine/commande.ts) : ce n'est pas
   * un prix, il vit sur la fiche ProduitCatalogue (colonne `etages`).
   */
  etages: number | null;
  /** false : absent du dernier tarif de sa grille → archivé, jamais supprimé. */
  actif: boolean;
  /** Versions dans l'ordre des dates d'effet. */
  prix: PrixAttendu[];
}

/** Entrée du rapport sur un produit : « « nom » — constat (précision). Action. » */
function surProduit(code: CodeRapport, nom: string, produitId: string, precision?: string): Signalement {
  return entreeRapport(code, { ou: `« ${nom} »`, precision }, { produitId });
}

/** Traduit le catalogue chargé depuis data/ en lignes Produit / PrixProduit. */
export function attenduDepuisCatalogue(catalogue: Catalogue): { produits: ProduitAttendu[]; signalements: Signalement[] } {
  const signalements: Signalement[] = [];
  const produits: ProduitAttendu[] = [];
  for (const p of catalogue.produits.values()) {
    const versions = catalogue.versions.filter((v) => v.grille === p.grille);
    const derniere = versions[versions.length - 1];
    const prix: PrixAttendu[] = [];
    let etages: number | null = null;
    for (const v of versions) {
      const l = v.lignes.get(p.id);
      if (!l) continue;
      etages = l.etages ?? null; // la version la plus récente l'emporte
      // Schéma : pour un produit au kilo, les seuils sont en GRAMMES. Aucun
      // produit au kilo n'a de seuil aujourd'hui ; si cela arrive, l'unité du
      // seuil (kg ou g ?) est à confirmer — on refuse plutôt que de deviner.
      if (p.unite === "kg" && (l.minQuantite !== null || l.minParSymbole !== null || l.maxParUnite !== null)) {
        signalements.push(surProduit("ERR_SEUIL_AU_KILO", p.produit, p.id, v.code));
        continue;
      }
      prix.push({
        valideDu: v.valideDu,
        valideAu: v.valideAu,
        prixCentimes: l.prixCentimes,
        basePrix: l.basePrix,
        minimum: l.minQuantite,
        minimumParSymbole: l.minParSymbole,
        maximum: l.maxParUnite?.valeur ?? null,
        versionCode: v.code,
        source: v.source,
      });
    }
    produits.push({
      cle: p.id,
      nom: p.produit,
      categorie: p.categorie,
      sousCategorie: p.sousCategorie === "" ? null : p.sousCategorie,
      unite: p.unite,
      regimePrix: p.regimePrix,
      estFavori: p.estFavori,
      etages,
      actif: derniere !== undefined && derniere.lignes.has(p.id),
      prix,
    });
  }
  return { produits, signalements };
}

// ------------------------------------------------------------ Plan

export type ChampsProduitModifiables = Partial<{
  nom: string;
  categorie: string;
  sousCategorie: string | null;
  estFavori: boolean;
  actif: boolean;
  regimePrix: RegimePrix;
  etages: number | null;
}>;

export type Operation =
  | { type: "creerProduit"; produit: ProduitAttendu }
  | { type: "modifierProduit"; idBase: number; cle: string; champs: ChampsProduitModifiables }
  | { type: "fermerVersion"; prixProduitId: number; cle: string; valideAu: DateISO }
  | { type: "insererVersion"; cle: string; prix: PrixAttendu };

export interface PlanEcriture {
  ok: boolean;
  /** Dans l'ordre d'exécution : créations, modifications, fermetures, insertions. */
  operations: Operation[];
  signalements: Signalement[];
  resume: {
    produitsCrees: number;
    produitsModifies: number;
    produitsInchanges: number;
    versionsFermees: number;
    versionsInserees: number;
  };
}

function memeContenu(e: ProduitAvecPrixBase["prix"][number], d: PrixAttendu): boolean {
  return (
    e.prixCentimes === d.prixCentimes &&
    e.basePrix === d.basePrix &&
    e.minimum === d.minimum &&
    e.minimumParSymbole === d.minimumParSymbole &&
    e.maximum === d.maximum &&
    e.versionCode === d.versionCode
  );
}

/**
 * Compare les fichiers à la base et liste les opérations à faire. Pure.
 * `aujourdhui` : date du jour du MAGASIN (Europe/Brussels), comme le déclencheur.
 */
export function planifierEcriture(
  attendus: readonly ProduitAttendu[],
  existants: readonly ProduitAvecPrixBase[],
  aujourdhui: DateISO,
): PlanEcriture {
  const signalements: Signalement[] = [];
  const creations: Operation[] = [];
  const modifications: Operation[] = [];
  const fermetures: Operation[] = [];
  const insertions: Operation[] = [];
  let produitsInchanges = 0;
  const hier = veille(aujourdhui);
  const parCle = new Map(existants.map((e) => [e.cleCatalogue, e]));

  for (const a of attendus) {
    const e = parCle.get(a.cle);
    if (!e) {
      creations.push({ type: "creerProduit", produit: a });
      for (const prix of a.prix) insertions.push({ type: "insererVersion", cle: a.cle, prix });
      continue;
    }
    const nbAvant = signalements.length + modifications.length + fermetures.length + insertions.length;

    // --- Fiche produit
    if (e.unite !== a.unite) {
      signalements.push(surProduit("ERR_CHANGEMENT_UNITE", a.nom, a.cle, `serveur « ${e.unite} », fichier « ${a.unite} »`));
      continue;
    }
    if (e.regimePrix !== null && e.regimePrix !== a.regimePrix) {
      signalements.push(surProduit("ERR_CHANGEMENT_REGIME", a.nom, a.cle, `serveur ${e.regimePrix}, fichier ${a.regimePrix}`));
      continue;
    }
    const champs: ChampsProduitModifiables = {};
    if (e.regimePrix === null) champs.regimePrix = a.regimePrix;
    if (e.nom !== a.nom) champs.nom = a.nom;
    if (e.categorie !== a.categorie) champs.categorie = a.categorie;
    if (e.sousCategorie !== a.sousCategorie) champs.sousCategorie = a.sousCategorie;
    if (e.estFavori !== a.estFavori) champs.estFavori = a.estFavori;
    if (e.actif && !a.actif) champs.actif = false;
    // Étages : une fiche importée avant la colonne `etages` (NULL) est
    // COMPLÉTÉE au réimport, sans toucher aux prix (versions figées). Un
    // nombre d'étages changé sur l'affiche est repris. En revanche, un fichier
    // SANS étages n'efface jamais ceux de la base : effacer supprimerait le
    // délai « gâteau à étages » (sens qui accepte à tort).
    // HYPOTHÈSE À VALIDER : retirer les étages d'un produit = décision du gérant, pas de l'import.
    if (a.etages !== null && e.etages !== a.etages) champs.etages = a.etages;
    if (a.etages === null && e.etages !== null) {
      signalements.push(surProduit("INFO_HYPOTHESE", a.nom, a.cle, `${e.etages} étages sur le serveur, aucun dans les fichiers : conservés, à confirmer par le gérant`));
    }
    if (!e.actif && a.actif) {
      // Un produit désactivé à la main (écran de gestion) n'est jamais réactivé en silence.
      signalements.push(surProduit("INFO_RESTE_ARCHIVE", a.nom, a.cle));
    }
    if (champs.nom !== undefined || champs.categorie !== undefined || champs.sousCategorie !== undefined) {
      signalements.push(surProduit("AVERT_LIBELLE_MODIFIE", a.nom, a.cle, `« ${e.nom} » → « ${a.nom} »`));
    }
    if (Object.keys(champs).length > 0) modifications.push({ type: "modifierProduit", idBase: e.id, cle: a.cle, champs });

    // --- Versions de prix
    for (const ve of e.prix) {
      const du = dateBaseVersIso(ve.valideDu);
      const au = ve.valideAu === null ? null : dateBaseVersIso(ve.valideAu);
      const va = a.prix.find((p) => p.valideDu === du);
      if (!va) {
        signalements.push(surProduit("ERR_VERSION_INCONNUE_EN_BASE", a.nom, a.cle, `prix valable à partir du ${dateEnTexte(du)}`));
        continue;
      }
      if (!memeContenu(ve, va)) {
        signalements.push(
          surProduit("ERR_VERSION_DEJA_IMPORTEE_DIFFERENTE", a.nom, a.cle, `prix du ${dateEnTexte(du)}, ${ve.versionCode ?? "saisie manuelle"}`),
        );
        continue;
      }
      if (au === va.valideAu) continue;
      if (au !== null) {
        signalements.push(
          surProduit(
            "ERR_PERIODE_DIFFERENTE",
            a.nom,
            a.cle,
            `prix du ${dateEnTexte(du)} : serveur jusqu’au ${dateEnTexte(au)}, fichiers ${va.valideAu ? "jusqu’au " + dateEnTexte(va.valideAu) : "toujours en vigueur"}`,
          ),
        );
        continue;
      }
      // au === null, va.valideAu !== null : fermeture de la version courante.
      if (du <= aujourdhui && va.valideAu! < hier) {
        signalements.push(surProduit("ERR_DATE_EFFET_PASSEE", a.nom, a.cle, `nouveau tarif au ${dateEnTexte(nouvelleDate(va.valideAu!))}`));
        continue;
      }
      fermetures.push({ type: "fermerVersion", prixProduitId: ve.id, cle: a.cle, valideAu: va.valideAu! });
    }
    const dejaEnBase = new Set(e.prix.map((ve) => dateBaseVersIso(ve.valideDu)));
    for (const va of a.prix) {
      if (!dejaEnBase.has(va.valideDu)) insertions.push({ type: "insererVersion", cle: a.cle, prix: va });
    }
    if (signalements.length + modifications.length + fermetures.length + insertions.length === nbAvant) produitsInchanges++;
  }

  for (const e of existants) {
    if (!attendus.some((a) => a.cle === e.cleCatalogue)) {
      signalements.push(surProduit("AVERT_PRODUIT_HORS_FICHIERS", e.nom, e.cleCatalogue, e.cleCatalogue));
    }
  }

  const ok = !signalements.some((s) => s.niveau === "bloquant");
  const operations = ok ? [...creations, ...modifications, ...fermetures, ...insertions] : [];
  return {
    ok,
    operations,
    signalements,
    resume: {
      produitsCrees: ok ? creations.length : 0,
      produitsModifies: ok ? modifications.length : 0,
      produitsInchanges,
      versionsFermees: ok ? fermetures.length : 0,
      versionsInserees: ok ? insertions.length : 0,
    },
  };
}

/** Lendemain calendaire (date d'effet d'une version dont la précédente ferme à `veilleEffet`). */
function nouvelleDate(veilleEffet: DateISO): DateISO {
  const [a, m, j] = veilleEffet.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j + 1)).toISOString().slice(0, 10);
}

// ------------------------------------------------------------ Exécution

/** Opérations sur la base, toutes exécutées DANS la transaction. */
export interface DepotEcritureCatalogue {
  /** Produits du catalogue de commande avec toutes leurs versions de prix. */
  lireProduitsCatalogue(): Promise<ProduitAvecPrixBase[]>;
  /** Crée les produits dans l'ordre donné ; renvoie clé → ProduitCatalogue.id. */
  creerProduits(produits: readonly ProduitAttendu[]): Promise<Map<string, number>>;
  modifierProduit(idBase: number, champs: ChampsProduitModifiables): Promise<void>;
  /** Ne change QUE valideAu (seul champ modifiable d'une version en vigueur). */
  fermerVersion(prixProduitId: number, valideAu: Date): Promise<void>;
  /** tauxTva NULL (à confirmer par le comptable), creePar NULL (import). */
  insererVersions(lignes: readonly { produitId: number; prix: PrixAttendu }[]): Promise<number>;
}

export interface ClientEcritureCatalogue {
  /** Exécute `travail` dans une transaction : tout est écrit, ou rien. */
  transaction<T>(travail: (depot: DepotEcritureCatalogue) => Promise<T>): Promise<T>;
}

export interface ResultatEcriture extends PlanEcriture {
  /** true si au moins une ligne a été écrite. */
  ecrit: boolean;
}

/**
 * Écrit le catalogue en base, dans une transaction. Si le plan contient un
 * blocage, rien n'est écrit. Si la base est déjà à jour, rien n'est écrit.
 */
export async function ecrireCatalogueEnBase(
  client: ClientEcritureCatalogue,
  catalogue: Catalogue,
  options: { aujourdhui: DateISO },
): Promise<ResultatEcriture> {
  const attendu = attenduDepuisCatalogue(catalogue);
  return client.transaction(async (depot) => {
    const existants = await depot.lireProduitsCatalogue();
    const plan = planifierEcriture(attendu.produits, existants, options.aujourdhui);
    plan.signalements.unshift(...attendu.signalements);
    if (attendu.signalements.some((s) => s.niveau === "bloquant")) {
      return { ...plan, ok: false, operations: [], ecrit: false };
    }
    if (!plan.ok || plan.operations.length === 0) return { ...plan, ecrit: false };

    const ids = new Map(existants.map((e) => [e.cleCatalogue, e.id]));
    const aCreer = plan.operations.flatMap((o) => (o.type === "creerProduit" ? [o.produit] : []));
    if (aCreer.length > 0) {
      for (const [cle, id] of await depot.creerProduits(aCreer)) ids.set(cle, id);
    }
    for (const o of plan.operations) {
      if (o.type === "modifierProduit") await depot.modifierProduit(o.idBase, o.champs);
    }
    // Étape 1 : fermer les versions courantes AVANT d'insérer les nouvelles.
    for (const o of plan.operations) {
      if (o.type === "fermerVersion") await depot.fermerVersion(o.prixProduitId, dateIsoVersBase(o.valideAu));
    }
    // Étape 2 : insérer.
    const lignes = plan.operations.flatMap((o) => {
      if (o.type !== "insererVersion") return [];
      const produitId = ids.get(o.cle);
      if (produitId === undefined) throw new Error(`Produit ${o.cle} sans identifiant après création.`);
      return [{ produitId, prix: o.prix }];
    });
    if (lignes.length > 0) await depot.insererVersions(lignes);
    return { ...plan, ecrit: true };
  });
}

/** Résumé en français pour le gérant. */
export function formaterResumeEcriture(r: PlanEcriture): string {
  const s = r.resume;
  if (!r.ok) return "Écriture REFUSÉE : rien n'a été écrit (voir les lignes « BLOQUANT »).";
  if (r.operations.length === 0) return `Base déjà à jour : rien à écrire (${s.produitsInchanges} produits inchangés).`;
  return [
    `${s.produitsCrees} produits créés · ${s.produitsModifies} fiches modifiées · ${s.produitsInchanges} inchangés`,
    `${s.versionsFermees} anciens prix fermés · ${s.versionsInserees} nouveaux prix enregistrés`,
  ].join("\n");
}
