// src/catalogue/index.ts
// Point d'entrée PUR du module catalogue (utilisable navigateur et serveur).
// Le chargement depuis les fichiers (node:fs) est dans ./chargerFichiers.ts.
//
// Aucun autre code ne lit le CSV directement : tout prix passe par
// getPrix(produitId, date).

export type * from "./types.ts";
export {
  ajouterVersion,
  catalogueVide,
  creerApiCatalogue,
  getPrix,
  getProduit,
  listerFavoris,
  listerParCategorie,
  versionEnVigueur,
} from "./catalogue.ts";
export type { ApiCatalogue, OptionsListe, ResultatAjoutVersion } from "./catalogue.ts";
export { importerCsvComptoir } from "./importComptoir.ts";
export { importerTarifsSurCommande } from "./importSurCommande.ts";
export { comparerVersions, formaterRapportDiff } from "./diff.ts";
export type { DiffTarif } from "./diff.ts";
export { controlerAffichesContreComptoir } from "./ecarts.ts";
export { identifiantProduit } from "./normaliser.ts";
export { PHOTOS_MODELES, categoriesPhotosModeles } from "./photosModeles.ts";
export type { PhotoModele } from "./photosModeles.ts";
import { PHOTOS_MODELES } from "./photosModeles.ts";
import type { PhotoModele } from "./photosModeles.ts";

/** Galerie des photos de modèles (écran de commande). `categorie` facultative. */
export function listerPhotosModeles(categorie?: string): readonly PhotoModele[] {
  return categorie === undefined ? PHOTOS_MODELES : PHOTOS_MODELES.filter((p) => p.categorie === categorie);
}
