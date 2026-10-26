// src/catalogue/photosModelesBase.ts
//
// Galerie de photos de modèles EN BASE (table « PhotoModele », migration
// 20261026150000_galerie_photos_en_base) : lecture et gestion par le gérant
// (ajouter, ranger, modifier la note, masquer). Propriétaire : `catalogue-prix`.
//
// Aucun import de Prisma ici : la base est atteinte par un `DepotPhotosModeles`
// reçu en paramètre (Prisma dans ./serveur.ts, faux en mémoire dans les tests).
//
// Ordre imposé à toute écriture :
//   1. tout est VALIDÉ avant la base (./photosModeles.ts, pur), avec un message
//      en français et une sortie (LOI 9) ;
//   2. une erreur de la base, s'il en reste une, passe par `diagnostiquer`
//      (src/lib/erreurBase.ts) : jamais de texte PostgreSQL à l'écran.
//
// Jamais de suppression (déclencheur ERR_PHOTO_IMMUABLE) : on MASQUE.
// L'identifiant ne change jamais (il est imprimé sur les bons).

import { diagnostiquer } from "../lib/erreurBase.ts";
import { journaliser, nouvelleReference } from "../lib/journal.ts";
import { signaler } from "../domaine/messages.ts";
import { succes, type Echec, type Resultat } from "../domaine/resultat.ts";
import {
  nomFichierPhoto,
  ordreEnFinDeRayon,
  photoDepuisBase,
  planDeplacement,
  rayonsDansLOrdre,
  trierPhotos,
  validerIdPhoto,
  validerNotePhoto,
  validerOrdrePhoto,
  validerPrenomPhoto,
  validerRattachementPhoto,
  validerRayonPhoto,
  type CatalogueDesPhotos,
  type LignePhotoBase,
  type ModificationPhoto,
  type PhotoModele,
  type SaisieCreationPhoto,
} from "./photosModeles.ts";
import type { DateISO } from "./types.ts";

// ------------------------------------------------------------ Accès base

export type ChampsPhotoModifiables = Partial<Pick<LignePhotoBase, "categorie" | "produitCle" | "supplements" | "note" | "ordre" | "masquee">>;

export interface DepotPhotosModeles {
  /** Toutes les photos (masquées comprises si demandé). Ordre quelconque. */
  lirePhotos(options: { inclureMasquees: boolean }): Promise<LignePhotoBase[]>;
  lirePhoto(id: string): Promise<LignePhotoBase | null>;
  /** Identifiant d'une NOUVELLE photo : 'P' + séquence "PhotoModele_numero_P_seq" (nextval, atomique). */
  reserverId(): Promise<string>;
  inserer(ligne: Omit<LignePhotoBase, "masquee">): Promise<LignePhotoBase>;
  modifier(id: string, champs: ChampsPhotoModifiables): Promise<LignePhotoBase>;
  /** Exécute `travail` dans une transaction : tout est écrit, ou rien. */
  transaction<T>(travail: (tx: DepotPhotosModeles) => Promise<T>): Promise<T>;
}

export interface OptionsGalerie {
  /** Date du jour du MAGASIN (Europe/Brussels) : les produits sont contrôlés au tarif de ce jour. */
  aujourdhui: () => DateISO;
}

export interface OptionsListePhotos {
  /** Écran du gérant : true. Galerie de la vendeuse : false (défaut). */
  inclureMasquees?: boolean;
  /** Un seul rayon. */
  categorie?: string;
}

/** Ce que l'écran d'ajout fournit pour enregistrer l'image (le module ne touche pas au disque). */
export interface CreationAvecImage extends SaisieCreationPhoto {
  /**
   * Écrit l'image sous ce nom dans DOSSIER_PHOTOS_MODELES. Appelé APRÈS la
   * validation et la réservation de l'identifiant, AVANT l'insertion : une
   * ligne en base ne désigne jamais une image absente. Si l'insertion échoue
   * ensuite, l'image reste orpheline (sans effet ; à nettoyer par la route).
   */
  enregistrerImage: (fichier: string) => Promise<void>;
}

export interface GaleriePhotosBase {
  listerPhotosModeles(options?: OptionsListePhotos): Promise<Resultat<PhotoModele[]>>;
  categoriesPhotosModeles(options?: { inclureMasquees?: boolean }): Promise<Resultat<string[]>>;
  getPhotoModele(id: string): Promise<Resultat<PhotoModele>>;
  creerPhotoModele(saisie: CreationAvecImage): Promise<Resultat<PhotoModele>>;
  modifierPhotoModele(id: string, modification: ModificationPhoto): Promise<Resultat<PhotoModele>>;
  masquerPhotoModele(id: string, masquee: boolean): Promise<Resultat<PhotoModele>>;
  deplacerPhotoModele(id: string, sens: "avant" | "apres"): Promise<Resultat<PhotoModele[]>>;
}

const ROUTE_JOURNAL = "catalogue/photos-modeles";

/** Photo introuvable : même refus que la lecture d'une ligne de commande (galerie.ts). */
function echecPhotoInconnue(): Echec {
  return signaler("ERR_SAISIE_INVALIDE", { champLibelle: "photo du modèle" }, { champ: "photoModele" });
}

/** Erreur de la base ou panne → échec typé, journalisé, jamais le texte brut. */
function echecTechnique(e: unknown): Echec {
  const d: Partial<Pick<ReturnType<typeof diagnostiquer>, "error" | "erreur">> & Echec = diagnostiquer(e, ROUTE_JOURNAL);
  // `error` / `erreur` : compatibilité des corps JSON des routes, pas du contrat Resultat.
  delete d.error;
  delete d.erreur;
  return d;
}

async function proteger<T>(travail: () => Promise<Resultat<T>>): Promise<Resultat<T>> {
  try {
    return await travail();
  } catch (e) {
    return echecTechnique(e);
  }
}

export function creerGaleriePhotos(depot: DepotPhotosModeles, catalogue: CatalogueDesPhotos, options: OptionsGalerie): GaleriePhotosBase {
  async function lister(o: OptionsListePhotos = {}): Promise<PhotoModele[]> {
    const lignes = await depot.lirePhotos({ inclureMasquees: o.inclureMasquees === true });
    const visibles = o.inclureMasquees === true ? lignes : lignes.filter((l) => !l.masquee);
    const triees = trierPhotos(visibles).map(photoDepuisBase);
    return o.categorie === undefined ? triees : triees.filter((p) => p.categorie === o.categorie);
  }

  /** Photo existante, ou refus. */
  async function existante(tx: DepotPhotosModeles, id: unknown): Promise<Resultat<LignePhotoBase>> {
    const v = validerIdPhoto(id);
    if (!v.ok) return v;
    const l = await tx.lirePhoto(v.donnees);
    return l ? succes(l) : echecPhotoInconnue();
  }

  return {
    listerPhotosModeles: (o) => proteger(async () => succes(await lister(o))),

    categoriesPhotosModeles: (o) =>
      proteger(async () => {
        const lignes = await depot.lirePhotos({ inclureMasquees: o?.inclureMasquees === true });
        return succes(rayonsDansLOrdre(o?.inclureMasquees === true ? lignes : lignes.filter((l) => !l.masquee)));
      }),

    getPhotoModele: (id) =>
      proteger(async () => {
        const l = await existante(depot, id);
        return l.ok ? succes(photoDepuisBase(l.donnees)) : l;
      }),

    creerPhotoModele: (saisie) =>
      proteger(async () => {
        // 1. Validation complète, sans rien écrire.
        const toutes = await depot.lirePhotos({ inclureMasquees: true });
        const rayons = [...new Set(toutes.map((p) => p.categorie))];
        const categorie = validerRayonPhoto(saisie.categorie, rayons);
        if (!categorie.ok) return categorie;
        const note = validerNotePhoto(saisie.note);
        if (!note.ok) return note;
        const prenom = validerPrenomPhoto(saisie.creePar);
        if (!prenom.ok) return prenom;
        const extension = nomFichierPhoto("P000", saisie.extension);
        if (!extension.ok) return extension;
        const rattache = await validerRattachementPhoto(catalogue, saisie.produit, saisie.supplements, options.aujourdhui());
        if (!rattache.ok) return rattache;

        // 2. Identifiant (séquence), puis image, puis ligne.
        const id = await depot.reserverId();
        const fichier = nomFichierPhoto(id, saisie.extension);
        if (!fichier.ok) {
          // Ne peut arriver que si la séquence renvoie un identifiant hors format.
          const reference = nouvelleReference();
          journaliser({ niveau: "erreur", code: "ERR_CONFIGURATION_SERVEUR", route: ROUTE_JOURNAL, reference, piste: `Identifiant réservé hors format : ${id}.` });
          return signaler("ERR_CONFIGURATION_SERVEUR", { reference });
        }
        await saisie.enregistrerImage(fichier.donnees);
        const ligne = await depot.transaction(async (tx) => {
          const rayon = await tx.lirePhotos({ inclureMasquees: true });
          return tx.inserer({
            id,
            categorie: categorie.donnees,
            produitCle: rattache.donnees.produit,
            supplements: rattache.donnees.supplements,
            note: note.donnees,
            ordre: ordreEnFinDeRayon(rayon, categorie.donnees),
            fichier: fichier.donnees,
            creePar: prenom.donnees,
          });
        });
        return succes(photoDepuisBase(ligne));
      }),

    modifierPhotoModele: (id, m) =>
      proteger(() =>
        depot.transaction(async (tx) => {
          const avant = await existante(tx, id);
          if (!avant.ok) return avant;
          const toutes = await tx.lirePhotos({ inclureMasquees: true });
          const champs: ChampsPhotoModifiables = {};

          if (m.categorie !== undefined) {
            const rayons = [...new Set(toutes.map((p) => p.categorie))];
            const c = validerRayonPhoto(m.categorie, rayons);
            if (!c.ok) return c;
            if (c.donnees !== avant.donnees.categorie) {
              champs.categorie = c.donnees;
              // Rangée dans un autre rayon : à la fin de celui-ci, sauf ordre explicite.
              if (m.ordre === undefined) champs.ordre = ordreEnFinDeRayon(toutes, c.donnees, avant.donnees.id);
            }
          }
          if (m.note !== undefined) {
            const n = validerNotePhoto(m.note);
            if (!n.ok) return n;
            if (n.donnees !== avant.donnees.note) champs.note = n.donnees;
          }
          if (m.ordre !== undefined) {
            const o = validerOrdrePhoto(m.ordre);
            if (!o.ok) return o;
            if (o.donnees !== avant.donnees.ordre) champs.ordre = o.donnees;
          }
          // Produit / suppléments : contrôlés au tarif du jour SEULEMENT s'ils
          // changent (un produit archivé depuis ne bloque pas une note à corriger).
          if (m.produit !== undefined || m.supplements !== undefined) {
            const produit = m.produit !== undefined ? m.produit : avant.donnees.produitCle;
            const supplements = m.supplements !== undefined ? m.supplements : avant.donnees.supplements;
            const produitChange = produit !== avant.donnees.produitCle;
            const supplementsChangent = !memesListes(supplements, avant.donnees.supplements);
            if (produitChange || supplementsChangent) {
              const r = await validerRattachementPhoto(
                catalogue,
                produitChange ? produit : null,
                supplementsChangent ? supplements : [],
                options.aujourdhui(),
              );
              if (!r.ok) return r;
              if (produitChange) champs.produitCle = r.donnees.produit;
              if (supplementsChangent) champs.supplements = r.donnees.supplements;
            }
          }
          if (Object.keys(champs).length === 0) return succes(photoDepuisBase(avant.donnees));
          return succes(photoDepuisBase(await tx.modifier(avant.donnees.id, champs)));
        }),
      ),

    masquerPhotoModele: (id, masquee) =>
      proteger(() =>
        depot.transaction(async (tx) => {
          if (typeof masquee !== "boolean") return signaler("ERR_SAISIE_INVALIDE", { champLibelle: "masquer la photo" }, { champ: "masquee" });
          const avant = await existante(tx, id);
          if (!avant.ok) return avant;
          if (avant.donnees.masquee === masquee) return succes(photoDepuisBase(avant.donnees));
          return succes(photoDepuisBase(await tx.modifier(avant.donnees.id, { masquee })));
        }),
      ),

    deplacerPhotoModele: (id, sens) =>
      proteger(() =>
        depot.transaction(async (tx) => {
          if (sens !== "avant" && sens !== "apres") return signaler("ERR_SAISIE_INVALIDE", { champLibelle: "sens du déplacement" }, { champ: "sens" });
          const avant = await existante(tx, id);
          if (!avant.ok) return avant;
          const toutes = await tx.lirePhotos({ inclureMasquees: true });
          const duRayon = toutes.filter((p) => p.categorie === avant.donnees.categorie);
          const changements = planDeplacement(duRayon, avant.donnees.id, sens);
          const parId = new Map(duRayon.map((p) => [p.id, p]));
          for (const c of changements) parId.set(c.id, await tx.modifier(c.id, { ordre: c.ordre }));
          return succes(trierPhotos([...parId.values()]).map(photoDepuisBase));
        }),
      ),
  };
}

function memesListes(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
