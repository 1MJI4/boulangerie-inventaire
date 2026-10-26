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
// Galerie de photos modèles : règles pures (contrôles, ordre d'affichage).
// Les photos elles-mêmes sont EN BASE (table « PhotoModele ») : lecture et
// écriture par src/catalogue/serveur.ts (listerPhotosModeles, getPhotoModele…).
export {
  noteContientUnPrix,
  rayonsDansLOrdre,
  trierPhotos,
  validerIdPhoto,
  validerNotePhoto,
  validerRayonPhoto,
} from "./photosModeles.ts";
export type { ModificationPhoto, PhotoModele, SaisieCreationPhoto } from "./photosModeles.ts";
