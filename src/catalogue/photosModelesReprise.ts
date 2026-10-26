// src/catalogue/photosModelesReprise.ts
//
// COPIE FIGÉE de la galerie au 26/10/2026, TEMPORAIRE. Propriétaire : `catalogue-prix`.
//
// Depuis le 26/10/2026 (décision du propriétaire : le gérant gère lui-même
// les photos), la SEULE source de vérité est la table « PhotoModele » en base
// (reprise des 152 lignes par la migration
// prisma/migrations/20261026150000_galerie_photos_en_base). Lecture serveur :
// listerPhotosModeles / categoriesPhotosModeles / getPhotoModele de
// src/catalogue/serveur.ts.
//
// Ce fichier n'existe QUE pour que les écrans et la route des commandes
// (périmètre `commandes-traiteur`) compilent tant qu'ils ne lisent pas encore
// la base. Il ne doit recevoir AUCUNE modification : une photo ajoutée,
// masquée ou rangée par le gérant n'y apparaît pas. Il sera supprimé dès que
// plus rien ne l'importe. photosModeles.test.ts vérifie qu'il reste
// identique, ligne à ligne, à la reprise de la migration.
//
// Les notes de prix du propriétaire et les hypothèses de rattachement
// (questions 72 à 80 de docs/QUESTIONS-GERANT.md) sont documentées dans la
// migration et dans docs/QUESTIONS-GERANT.md. AUCUN PRIX ICI (LOI 1).

import type { PhotoModele } from "./photosModeles.ts";

/** @deprecated Forme de la copie figée. Utiliser `PhotoModele` (lu en base). */
export type PhotoModeleReprise = PhotoModele & {
  /** @deprecated Chemin public de l'ancienne image (`/modeles/G043.jpg`). Utiliser `url`. */
  fichier: string;
};

type Brute = { id: string; fichier: string; produit: string | null; categorie: string; supplements?: readonly string[]; note?: string };

const NOTE_PHOTO = "Modèle avec photo imprimée (+ supplément)";
const NOTE_WHATSAPP = "Déco à valider sur WhatsApp";

const BRUTES: readonly Brute[] = [
  // Bavarois
  { id: "G001", fichier: "/modeles/G001.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois" },
  { id: "G002", fichier: "/modeles/G002.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois" },
  { id: "G005", fichier: "/modeles/G005.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois" },
  { id: "G008", fichier: "/modeles/G008.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois" },
  { id: "G017", fichier: "/modeles/G017.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois", note: "Bavarois mousse chocolat" },
  { id: "G022", fichier: "/modeles/G022.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois" },
  { id: "G025", fichier: "/modeles/G025.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois", note: "Bavarois framboise" },
  { id: "G036", fichier: "/modeles/G036.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois" },
  { id: "G042", fichier: "/modeles/G042.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois", note: "Bavarois citron" },
  { id: "G058", fichier: "/modeles/G058.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois", note: "Forêt noire" },
  { id: "G062", fichier: "/modeles/G062.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois" },
  { id: "G067", fichier: "/modeles/G067.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois" },
  { id: "G074", fichier: "/modeles/G074.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois" },
  { id: "G097", fichier: "/modeles/G097.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois" },
  { id: "G102", fichier: "/modeles/G102.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois", note: NOTE_WHATSAPP },
  { id: "G106", fichier: "/modeles/G106.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois", note: NOTE_PHOTO },
  { id: "G121", fichier: "/modeles/G121.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois" },
  { id: "G129", fichier: "/modeles/G129.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois", note: NOTE_PHOTO },
  { id: "G136", fichier: "/modeles/G136.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois" },
  { id: "G143", fichier: "/modeles/G143.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois" },
  { id: "G189", fichier: "/modeles/G189.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois" },
  { id: "G194", fichier: "/modeles/G194.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois" },
  { id: "G195", fichier: "/modeles/G195.jpg", produit: "gateaux-sur-commande/bavarois", categorie: "Bavarois" },

  // Crème fraîche
  { id: "G007", fichier: "/modeles/G007.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche" },
  { id: "G028", fichier: "/modeles/G028.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche" },
  { id: "G034", fichier: "/modeles/G034.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche", note: NOTE_PHOTO },
  { id: "G039", fichier: "/modeles/G039.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche" },
  { id: "G044", fichier: "/modeles/G044.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche", note: NOTE_PHOTO },
  { id: "G049", fichier: "/modeles/G049.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche" },
  { id: "G050", fichier: "/modeles/G050.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche", note: "Pochage (supplément à confirmer)" },
  { id: "G051", fichier: "/modeles/G051.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche" },
  { id: "G052", fichier: "/modeles/G052.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche", note: NOTE_PHOTO },
  { id: "G056", fichier: "/modeles/G056.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche" },
  { id: "G057", fichier: "/modeles/G057.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche", note: NOTE_PHOTO },
  { id: "G066", fichier: "/modeles/G066.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche" },
  { id: "G070", fichier: "/modeles/G070.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche", note: NOTE_PHOTO },
  { id: "G084", fichier: "/modeles/G084.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche" },
  { id: "G085", fichier: "/modeles/G085.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche" },
  { id: "G087", fichier: "/modeles/G087.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche" },
  { id: "G091", fichier: "/modeles/G091.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche" },
  { id: "G092", fichier: "/modeles/G092.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche" },
  { id: "G093", fichier: "/modeles/G093.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche", note: NOTE_PHOTO },
  { id: "G109", fichier: "/modeles/G109.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche", note: NOTE_PHOTO },
  { id: "G125", fichier: "/modeles/G125.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche" },
  { id: "G127", fichier: "/modeles/G127.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche" },
  { id: "G133", fichier: "/modeles/G133.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche" },
  { id: "G135", fichier: "/modeles/G135.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche" },
  { id: "G152", fichier: "/modeles/G152.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche", note: NOTE_PHOTO },
  { id: "G174", fichier: "/modeles/G174.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche" },
  { id: "G190", fichier: "/modeles/G190.jpg", produit: "gateaux-sur-commande/creme-fraiche", categorie: "Crème fraîche" },

  // Entremet
  { id: "G018", fichier: "/modeles/G018.jpg", produit: "gateaux-sur-commande/entremet", categorie: "Entremet" },
  { id: "G024", fichier: "/modeles/G024.jpg", produit: "gateaux-sur-commande/entremet", categorie: "Entremet" },
  { id: "G041", fichier: "/modeles/G041.jpg", produit: "gateaux-sur-commande/entremet", categorie: "Entremet" },
  { id: "G048", fichier: "/modeles/G048.jpg", produit: "gateaux-sur-commande/entremet", categorie: "Entremet" },
  { id: "G065", fichier: "/modeles/G065.jpg", produit: "gateaux-sur-commande/entremet", categorie: "Entremet", note: "Forêt noire ronde, au prix de l’entremet" },
  { id: "G071", fichier: "/modeles/G071.jpg", produit: "gateaux-sur-commande/entremet", categorie: "Entremet", note: `Tiramisu, au prix de l’entremet · ${NOTE_PHOTO}` },
  { id: "G072", fichier: "/modeles/G072.jpg", produit: "gateaux-sur-commande/entremet", categorie: "Entremet", note: `Noisette chocolat · ${NOTE_WHATSAPP}` },
  { id: "G075", fichier: "/modeles/G075.jpg", produit: "gateaux-sur-commande/entremet", categorie: "Entremet", note: "Entremet sur deux étages" },
  { id: "G079", fichier: "/modeles/G079.jpg", produit: "gateaux-sur-commande/entremet", categorie: "Entremet", note: NOTE_PHOTO },
  { id: "G082", fichier: "/modeles/G082.jpg", produit: "gateaux-sur-commande/entremet", categorie: "Entremet" },
  { id: "G111", fichier: "/modeles/G111.jpg", produit: "gateaux-sur-commande/entremet", categorie: "Entremet" },
  { id: "G112", fichier: "/modeles/G112.jpg", produit: "gateaux-sur-commande/entremet", categorie: "Entremet" },
  { id: "G130", fichier: "/modeles/G130.jpg", produit: "gateaux-sur-commande/entremet", categorie: "Entremet" },
  { id: "G138", fichier: "/modeles/G138.jpg", produit: "gateaux-sur-commande/entremet", categorie: "Entremet" },

  // Cake nature
  { id: "G110", fichier: "/modeles/G110.jpg", produit: "gateaux-sur-commande/cake-nature", categorie: "Cake nature", note: `Cake chocolat · ${NOTE_PHOTO}` },
  { id: "G142", fichier: "/modeles/G142.jpg", produit: "gateaux-sur-commande/cake-nature", categorie: "Cake nature" },

  // Layer Cake
  { id: "G006", fichier: "/modeles/G006.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G010", fichier: "/modeles/G010.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake", note: "Layer cake triple chocolat" },
  { id: "G011", fichier: "/modeles/G011.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake", note: `Demi layer cake · ${NOTE_WHATSAPP}` },
  { id: "G012", fichier: "/modeles/G012.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G016", fichier: "/modeles/G016.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G021", fichier: "/modeles/G021.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G023", fichier: "/modeles/G023.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G026", fichier: "/modeles/G026.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G029", fichier: "/modeles/G029.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G031", fichier: "/modeles/G031.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G037", fichier: "/modeles/G037.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G046", fichier: "/modeles/G046.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G053", fichier: "/modeles/G053.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G060", fichier: "/modeles/G060.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G080", fichier: "/modeles/G080.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake", note: `Layer cake boîte surprise · ${NOTE_WHATSAPP}` },
  { id: "G086", fichier: "/modeles/G086.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G090", fichier: "/modeles/G090.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G098", fichier: "/modeles/G098.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G099", fichier: "/modeles/G099.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G100", fichier: "/modeles/G100.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G105", fichier: "/modeles/G105.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G108", fichier: "/modeles/G108.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G113", fichier: "/modeles/G113.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G114", fichier: "/modeles/G114.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G116", fichier: "/modeles/G116.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G119", fichier: "/modeles/G119.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G123", fichier: "/modeles/G123.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G128", fichier: "/modeles/G128.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G140", fichier: "/modeles/G140.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G146", fichier: "/modeles/G146.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G191", fichier: "/modeles/G191.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G192", fichier: "/modeles/G192.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },
  { id: "G199", fichier: "/modeles/G199.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Layer Cake" },

  // Pâte à sucre (dossier « Pâte à sucre/Layer Cake »)
  { id: "G019", fichier: "/modeles/G019.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Pâte à sucre", supplements: ["gateaux-sur-commande/supplement-pate-a-sucre"], note: "Layer cake en forme de cœur" },
  { id: "G027", fichier: "/modeles/G027.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Pâte à sucre", supplements: ["gateaux-sur-commande/supplement-pate-a-sucre"], note: NOTE_PHOTO },
  { id: "G040", fichier: "/modeles/G040.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Pâte à sucre", supplements: ["gateaux-sur-commande/supplement-pate-a-sucre"] },
  { id: "G043", fichier: "/modeles/G043.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Pâte à sucre", supplements: ["gateaux-sur-commande/supplement-pate-a-sucre"] },
  { id: "G076", fichier: "/modeles/G076.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Pâte à sucre", supplements: ["gateaux-sur-commande/supplement-pate-a-sucre"] },
  { id: "G077", fichier: "/modeles/G077.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Pâte à sucre", supplements: ["gateaux-sur-commande/supplement-pate-a-sucre"] },
  { id: "G089", fichier: "/modeles/G089.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Pâte à sucre", supplements: ["gateaux-sur-commande/supplement-pate-a-sucre"] },
  { id: "G132", fichier: "/modeles/G132.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Pâte à sucre", supplements: ["gateaux-sur-commande/supplement-pate-a-sucre"] },
  { id: "G188", fichier: "/modeles/G188.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Pâte à sucre", supplements: ["gateaux-sur-commande/supplement-pate-a-sucre"] },
  { id: "G197", fichier: "/modeles/G197.jpg", produit: "gateaux-sur-commande/layer-cake", categorie: "Pâte à sucre", supplements: ["gateaux-sur-commande/supplement-pate-a-sucre"] },

  // Number Cake
  { id: "G004", fichier: "/modeles/G004.jpg", produit: "gateaux-sur-commande/number-cake", categorie: "Number Cake" },
  { id: "G035", fichier: "/modeles/G035.jpg", produit: "gateaux-sur-commande/number-cake", categorie: "Number Cake" },
  { id: "G095", fichier: "/modeles/G095.jpg", produit: "gateaux-sur-commande/number-cake", categorie: "Number Cake" },
  { id: "G137", fichier: "/modeles/G137.jpg", produit: "gateaux-sur-commande/number-cake", categorie: "Number Cake" },
  { id: "G147", fichier: "/modeles/G147.jpg", produit: "gateaux-sur-commande/number-cake", categorie: "Number Cake" },
  { id: "G148", fichier: "/modeles/G148.jpg", produit: "gateaux-sur-commande/number-cake", categorie: "Number Cake" },
  { id: "G198", fichier: "/modeles/G198.jpg", produit: "gateaux-sur-commande/number-cake", categorie: "Number Cake" },

  // Pièce montée 2 étages
  { id: "G013", fichier: "/modeles/G013.jpg", produit: "gateaux-sur-commande/gateau-de-mariage", categorie: "Pièce montée 2 étages" },
  { id: "G020", fichier: "/modeles/G020.jpg", produit: "gateaux-sur-commande/gateau-de-mariage", categorie: "Pièce montée 2 étages" },
  { id: "G094", fichier: "/modeles/G094.jpg", produit: "gateaux-sur-commande/gateau-de-mariage", categorie: "Pièce montée 2 étages" },
  { id: "G096", fichier: "/modeles/G096.jpg", produit: "gateaux-sur-commande/gateau-de-mariage", categorie: "Pièce montée 2 étages" },
  { id: "G118", fichier: "/modeles/G118.jpg", produit: "gateaux-sur-commande/gateau-de-mariage", categorie: "Pièce montée 2 étages" },
  { id: "G126", fichier: "/modeles/G126.jpg", produit: "gateaux-sur-commande/gateau-de-mariage", categorie: "Pièce montée 2 étages" },
  { id: "G145", fichier: "/modeles/G145.jpg", produit: "gateaux-sur-commande/gateau-de-mariage", categorie: "Pièce montée 2 étages" },
  { id: "G154", fichier: "/modeles/G154.jpg", produit: "gateaux-sur-commande/gateau-de-mariage", categorie: "Pièce montée 2 étages" },
  { id: "G155", fichier: "/modeles/G155.jpg", produit: "gateaux-sur-commande/gateau-de-mariage", categorie: "Pièce montée 2 étages" },

  // Pièce montée 3 étages
  { id: "G045", fichier: "/modeles/G045.jpg", produit: "gateaux-sur-commande/piece-montee", categorie: "Pièce montée 3 étages" },
  { id: "G103", fichier: "/modeles/G103.jpg", produit: "gateaux-sur-commande/piece-montee", categorie: "Pièce montée 3 étages" },

  // Mini-pâtisseries
  { id: "G009", fichier: "/modeles/G009.jpg", produit: "gateaux-sur-commande/mini-bavarois", categorie: "Mini-pâtisseries" },
  { id: "G015", fichier: "/modeles/G015.jpg", produit: "gateaux-sur-commande/mini-bavarois", categorie: "Mini-pâtisseries" },
  { id: "G083", fichier: "/modeles/G083.jpg", produit: null, categorie: "Mini-pâtisseries" },
  { id: "G101", fichier: "/modeles/G101.jpg", produit: null, categorie: "Mini-pâtisseries" },
  { id: "G115", fichier: "/modeles/G115.jpg", produit: null, categorie: "Mini-pâtisseries" },
  { id: "G139", fichier: "/modeles/G139.jpg", produit: null, categorie: "Mini-pâtisseries" },
  { id: "G144", fichier: "/modeles/G144.jpg", produit: null, categorie: "Mini-pâtisseries" },
  // G165 : doublon exact, non retenu (voir en-tête).

  // Tartes
  { id: "G047", fichier: "/modeles/G047.jpg", produit: null, categorie: "Tartes" },
  { id: "G081", fichier: "/modeles/G081.jpg", produit: null, categorie: "Tartes" },
  { id: "G104", fichier: "/modeles/G104.jpg", produit: "gateaux-et-tartes/tarte/moelleux-6p", categorie: "Tartes", note: "Smarties et Maltesers (supplément à confirmer)" },
  { id: "G107", fichier: "/modeles/G107.jpg", produit: null, categorie: "Tartes" },
  // G161 : doublon exact, non retenu (voir en-tête).

  // Bûches
  { id: "G003", fichier: "/modeles/G003.jpg", produit: null, categorie: "Bûches" },
  { id: "G030", fichier: "/modeles/G030.jpg", produit: null, categorie: "Bûches" },
  { id: "G055", fichier: "/modeles/G055.jpg", produit: null, categorie: "Bûches" },
  { id: "G063", fichier: "/modeles/G063.jpg", produit: null, categorie: "Bûches" },
  { id: "G078", fichier: "/modeles/G078.jpg", produit: null, categorie: "Bûches" },
  { id: "G117", fichier: "/modeles/G117.jpg", produit: null, categorie: "Bûches" },

  // Mini pizza / quiche (dossier « Mini pizza - quiche »)
  { id: "S002", fichier: "/modeles/S002.jpg", produit: "sur-commande/mini-pizza-quiche", categorie: "Mini pizza / quiche" },
  { id: "S003", fichier: "/modeles/S003.jpg", produit: "sur-commande/mini-pizza-quiche", categorie: "Mini pizza / quiche" },

  // Mini-sandwichs garnis
  { id: "S001", fichier: "/modeles/S001.jpg", produit: "sur-commande/mini-sandwichs-garnis", categorie: "Mini-sandwichs garnis" },
  { id: "S004", fichier: "/modeles/S004.jpg", produit: "sur-commande/mini-sandwichs-garnis", categorie: "Mini-sandwichs garnis" },

  // Grand pain surprise
  { id: "S005", fichier: "/modeles/S005.jpg", produit: "sur-commande/grand-pain-surprise", categorie: "Grand pain surprise" },
  { id: "S006", fichier: "/modeles/S006.jpg", produit: "sur-commande/grand-pain-surprise", categorie: "Grand pain surprise" },
  { id: "S007", fichier: "/modeles/S007.jpg", produit: "sur-commande/grand-pain-surprise", categorie: "Grand pain surprise" },
  { id: "S008", fichier: "/modeles/S008.jpg", produit: "sur-commande/grand-pain-surprise", categorie: "Grand pain surprise" },
];

/**
 * @deprecated Copie figée de la reprise : ne voit ni les photos ajoutées, ni
 * les photos masquées ou rangées par le gérant. Côté serveur, utiliser
 * `listerPhotosModeles()` de src/catalogue/serveur.ts (table « PhotoModele »).
 * `url` pointe ici sur l'ancienne image de public/modeles/.
 */
export const PHOTOS_MODELES: readonly PhotoModeleReprise[] = BRUTES.map((p, i) => ({
  id: p.id,
  url: p.fichier,
  fichier: p.fichier,
  produit: p.produit,
  categorie: p.categorie,
  supplements: p.supplements ?? [],
  note: p.note ?? null,
  masquee: false,
  ordre: (i + 1) * 10,
}));

/**
 * @deprecated Rayons de la copie figée, dans l'ordre de la table. Côté
 * serveur, utiliser `categoriesPhotosModeles()` de src/catalogue/serveur.ts.
 */
export function categoriesPhotosModeles(table: readonly Pick<PhotoModele, "categorie">[] = PHOTOS_MODELES): string[] {
  return [...new Set(table.map((p) => p.categorie))];
}
