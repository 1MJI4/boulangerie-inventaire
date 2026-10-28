'use client';

// src/components/FormulaireCommande.tsx
//
// Prise et correction d'une commande sur mesure (propriétaire :
// `commandes-traiteur`). Objectif : un plateau complet saisi en moins de
// 90 secondes, sans erreur de prix ni de date, client en face.
//
// Ce que cet écran NE fait PAS lui-même : décider. Prix, minimums, plancher,
// unité, date, délai, lendemain, heure de retrait, acompte… sont tranchés par
// le domaine (`controlerLigne`, `blocagesCommande`, `controlerCommande`), sur
// le catalogue de commande (GET /api/tarifs) et les jours fermés / règlement
// (GET /api/calendrier). Le serveur rejoue exactement les mêmes fonctions à
// l'enregistrement et ne croit aucun prix envoyé par la tablette (KO-3).
//
// Parcours (fiche de l'agent) : client → date et heure de retrait EN PREMIER
// → produits → précisions → total, acompte → valider. Chaque refus s'affiche
// à la saisie de la ligne, avec le bouton qui corrige en un geste (LOI 7 et 8).
// Tous les chiffres se tapent au pavé de l'application (R37).
//
// Disposition tablette (retour du propriétaire, 15/10/2026) : les produits
// d'un côté (UNE grille + recherche, plus d'onglets par régime) ; le pavé, le
// bon et le total de l'autre (`DispositionAvecPave`, côté du pouce). Le régime
// reste lu sur chaque produit (LOI 6), affiché discrètement (« /pers. »).
// Toucher un produit = +1 (5 touchers = 5) ; sous le minimum, la ligne est
// refusée à la saisie avec « Passer à N » — jamais pré-remplie en silence.

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type Ref,
  type SetStateAction,
} from 'react';
import { Bouton, Carte, Chargement, Entete } from '@/components/ui';
import { useEquipe } from '@/lib/vendeurs';
import { surLesGateaux, type Commande, type ModePaiement, type Origine } from '@/lib/commandes';
import type { OptionsGateau } from '@/lib/gateaux';
import { dateDuJour } from '@/lib/dateProduction';
import {
  BasculeCotePave,
  DispositionAvecPave,
  PaveDecimalPoids,
  PaveEntier,
  PaveMontant,
  PaveTelephone,
  useCotePave,
} from '@/components/saisie';
import { ContexteTaillePave } from '@/components/saisie/taillePave';
import { ListeSignalements, type SignalementAffichable } from '@/components/signalement';
import { RappelApresAction, RappelChargement } from '@/components/rappels';
import {
  blocagesCommande,
  controlerCommande,
  controlerLigne,
  libelleProduit,
  totalEnCours,
  type CommandeControlee,
  type ContexteCommande,
  type LigneControlee,
} from '@/domaine/commande';
import { ajouterJoursOuvres, fermetureDuJour, formaterDate, prochainJourOuvert } from '@/domaine/calendrier';
import { formaterEuros, resteDu, somme } from '@/domaine/argent';
import { formaterQuantite } from '@/domaine/unites';
import { LIBELLES_FORME, libelleCorrection } from '@/domaine/messages';
import { estForme, formesPossibles } from '@/domaine/formes';
import { estSupplementParPersonne } from '@/domaine/supplementsParPersonne';
import { horairesOuvertureDuJour, validerJourMeme, validerLendemain } from '@/domaine/reglement';
import { validerPhotoEnAttente } from '@/domaine/coherence';
import { estGateauSimpleSurCommande, taillesAPartirDuMinimum, taillesProches } from '@/domaine/minimums';
import { formesAImprimer } from '@/lib/ticketCanvas';
import {
  FAMILLES_GATEAU,
  JOURS_AVANT_ARCHIVAGE,
  REGLES_FORME,
  SUPPLEMENTS_PAR_PERSONNE,
  SUPPLEMENT_ECRITURE as SUPPLEMENT_ECRITURE_DOMAINE,
  TAILLES_INTERDITES,
} from '@/domaine/constantes';
import { CORRESPONDANCES_COMPTOIR } from '@/catalogue/correspondancesComptoir';
import { LIBELLES_SELON_GOUT } from '@/catalogue/libellesSelonGout';
import { GOUTS_SUR_COMMANDE } from '@/catalogue/goutsSurCommande';
import { GOUT_AU_CHOIX, goutsAttendus, ordonnerGouts, type ChoixGout } from '@/domaine/gouts';
import { gateauSurCommandeDe } from '@/domaine/prixComptoir';
import type { Echec, Resultat } from '@/domaine/resultat';
import type { Deverrouillage, FicheTarifee, Forme, SortieRemplacement } from '@/domaine/types';
import {
  champLocal,
  choisirTaille,
  echecReseau,
  ficheComptoirPourTaille,
  gateauDeLaLigne,
  libelleLigneEcran,
  suivreGout,
  tailleChoisie,
  estLigneAncienTarif,
  ficheDe,
  lignesIdentiques,
  refusAncienTarif,
  indexLigne,
  ligneVide,
  lireReponse,
  nouvelleCle,
  resoudreLocal,
  fichesVisibles,
  majLigneEcran,
  quantiteAuBon,
  boutonsFamilles,
  estSupplement,
  gateauxAuBon,
  aSupplement,
  appliquerRemplacement,
  basculerSupplementParPersonne,
  remplacementsProposes,
  synchroniserSupplementsParPersonne,
  synchroniserSupplementsGateau,
  supplementImpose,
  supplementCouvert,
  saisirSurLeGateau,
  indexGateauPateASucre,
  ecrireChiffresOuLettres,
  choisirNombreSymboles,
  basculerFormesLibres,
  formesLibresEnregistrees,
  SUPPLEMENT_PATE_A_SUCRE,
  estLigneGateau,
  estFicheGateauDuComptoir,
  separerLigneGateau,
  SUPPLEMENT_ECRITURE,
  SUPPLEMENT_PHOTO,
  toucherProduit,
  versCommandeSaisie,
  type CatalogueCommande,
  type ContexteCalendrier,
  type EtatFormulaire,
  type FicheCatalogue,
  type LigneEcran,
} from '@/components/commande/modele';
import { sortieDe } from '@/components/commande/sorties';
import { CHAMPS_A_PHRASE, estManqueSimple, libelleManque, MANQUE_SIMPLE, texteChampVide } from '@/components/commande/manques';
import { estSeparationProposee, libelleSeparation } from '@/domaine/unGateauParLigne';
import {
  empreinteSaisie,
  saisieEntamee,
  texteHeureRetrait,
  texteMontantEnCours,
  texteResteEnCours,
} from '@/components/commande/saisieEnCours';
import { aGarderSurLaTablette, classerReponse, TEXTES_HORS_LIGNE, type CommandeEnAttente } from '@/lib/commandesHorsLigne';
import { envoyerAuServeur, garderCommande, noterIssue, nouvelIdCommande, trouverCommandeEnAttente } from '@/lib/envoiHorsLigne';
import { ChampPave } from '@/components/commande/ChampPave';
import { AccesGerant } from '@/components/commande/AccesGerant';
import { BandeRetrait } from '@/components/commande/BandeRetrait';
import { GaleriePhotos } from '@/components/commande/GaleriePhotos';
import { ajouterAvecPhoto, ficheDePhoto, navigationPourPhoto, retirerPhoto } from '@/components/commande/galerie';
import type { PhotoModele } from '@/catalogue/photosModeles';
import { useUrlPhoto } from '@/components/commande/photosClient';

const CHAMP_TEXTE =
  'min-h-12 w-full rounded-xl border-2 border-line-fort bg-surface px-3 text-base text-ink placeholder:text-ink-3';
const TITRE = 'mb-3 text-base font-semibold text-ink';

/** Unité affichée d'une quantité en pièces : parts pour un prix par personne (donnée du catalogue). */
function uniteDe(fiche: FicheTarifee | null, ligne?: Pick<LigneEcran, 'produitId' | 'gateauLibre'>): string {
  // Ligne libre déclarée gâteau (« C'est un gâteau ? » : oui) : la quantité est en parts.
  if (ligne && ligne.produitId === null && ligne.gateauLibre === true) return 'parts';
  return fiche?.prix.basePrix === 'personne' ? 'parts' : 'pièces';
}

/** Goût d'un gâteau libre (« Autre demande » déclarée gâteau) : un goût, liste du gérant. */
const CHOIX_GOUT_LIBRE: ChoixGout = { liste: 'parfum', parEtage: false };

/** « parts × prix par personne = total » — les trois composantes que le vendeur annonce. */
function composantes(l: LigneControlee, unite: string): string {
  const total = formaterEuros(l.totalCentimes);
  const pu = formaterEuros(l.prixUnitaireCentimes);
  if (l.unite === 'kg') return `${formaterQuantite('kg', l.quantite)} × ${pu}/kg = ${total}`;
  if (l.basePrix === 'forfait') return `${l.quantite} × ${pu} = ${total}`;
  // « 1 pièce », « 1 part » : unité au singulier pour une seule unité.
  const libelle = l.quantite === 1 ? unite.replace(/s$/, '') : unite;
  return `${l.quantite} ${libelle} × ${pu} = ${total}`;
}

type DemandeGerant = { raison: string; appliquer: (d: Deverrouillage) => void };
/** Retour visuel d'un ajout : carte produit, ligne du bon et total en surbrillance brève. */
type Eclair = { cle: string; produitId: string | null; n: number };

/** Écran étroit (téléphone) : même seuil que `DispositionAvecPave` (pavé en bas). */
const REQUETE_ETROIT = '(max-width: 639.98px)';
function abonnerEtroit(rappel: () => void) {
  const mq = window.matchMedia(REQUETE_ETROIT);
  mq.addEventListener('change', rappel);
  return () => mq.removeEventListener('change', rappel);
}
function useEcranEtroit(): boolean {
  return useSyncExternalStore(abonnerEtroit, () => window.matchMedia(REQUETE_ETROIT).matches, () => false);
}

/** Libellé discret du régime, LU sur le produit (LOI 6). */
function libelleRegime(fiche: FicheTarifee | null, libre: boolean): string {
  if (libre) return 'Autre demande — à confirmer par le pâtissier';
  const regime = fiche?.produit.regimePrix ?? null;
  return regime === 'B' ? 'Salé sur commande' : regime === 'C' ? 'Gâteau sur commande' : regime === 'A' ? 'Comptoir' : '';
}
type Validee = { id: number; numero: string; controlee: CommandeControlee | null };

/** Tablette : espace laissé sous l'espace de travail, en px (la page ne défile jamais). */
const MARGE_BAS_CADRE_PX = 12;

/** Champs d'une ligne gâteau affichés dans son bloc « Sur le gâteau » (lot 2, 28/10/2026). */
const CHAMPS_SUR_LE_GATEAU: ReadonlySet<string> = new Set(['texteGateau', 'photoImprimee']);

/* ======================================================================== */

/**
 * Instantané de l'écran gardé avec une commande hors ligne : de quoi la rouvrir
 * telle quelle si le magasin la refuse à l'arrivée (« Rouvrir pour corriger »).
 */
type EcranGarde = {
  client: string;
  telephone: string;
  dateRetrait: string | null;
  heureRetrait: string;
  origine: Origine;
  modePaiement: ModePaiement;
  lignes: LigneEcran[];
  acompte: number | null;
  totalConvenu: number | null;
  remise: Deverrouillage | null;
  photoWhatsapp: boolean;
  demandeInhabituelle: boolean;
  zoneDessin: boolean;
  remarques: string;
};

/**
 * Dernier calendrier / catalogue / options reçus dans cette session : une
 * commande suivante peut être prise même si le réseau vient de tomber (sans
 * cela, « Nouvelle commande » hors ligne ouvrirait un écran vide). Mémoire de la
 * page seulement, jamais au-delà de la journée.
 * HYPOTHÈSE À VALIDER : 3 h de validité ; le serveur rejoue tous les prix et
 * toutes les règles à l'envoi, un tarif changé entre-temps y est refusé.
 */
const MEMOIRE_CHARGEMENT_MS = 3 * 60 * 60_000;
const memoireChargement: {
  cal: (ContexteCalendrier & { heure: string }) | null;
  catalogues: Map<string, CatalogueCommande>;
  options: OptionsGateau | null;
  le: number;
} = { cal: null, catalogues: new Map(), options: null, le: 0 };
function memoireValable(): boolean {
  return (
    memoireChargement.cal !== null &&
    Date.now() - memoireChargement.le < MEMOIRE_CHARGEMENT_MS &&
    memoireChargement.cal.aujourdhui === dateDuJour(new Date())
  );
}

export function FormulaireCommande({ commande }: { commande?: Commande }) {
  // « Nouvelle commande » après une commande gardée hors ligne : on repart d'un
  // écran vierge sans recharger la page (impossible sans réseau).
  const [tour, setTour] = useState(0);
  return <SaisieCommande key={tour} commande={commande} onRecommencer={() => setTour((n) => n + 1)} />;
}

function SaisieCommande({ commande, onRecommencer }: { commande?: Commande; onRecommencer: () => void }) {
  const router = useRouter();
  const { vendeur, prete } = useEquipe();
  const modification = commande !== undefined;

  // --- Données serveur ---------------------------------------------------
  const [cal, setCal] = useState<(ContexteCalendrier & { heure: string }) | null>(null);
  const [catalogue, setCatalogue] = useState<CatalogueCommande | null>(null);
  const [options, setOptions] = useState<OptionsGateau | null>(null);
  const [refusChargement, setRefusChargement] = useState<Echec | null>(null);

  // --- Saisie --------------------------------------------------------------
  const [client, setClient] = useState(commande?.client ?? '');
  const [telephone, setTelephone] = useState(commande?.telephone ?? '');
  const [dateRetrait, setDateRetrait] = useState<string | null>(commande?.retraitLe ?? null);
  const [heureRetrait, setHeureRetrait] = useState(commande?.retraitHeure ?? '');
  const [origine, setOrigine] = useState<Origine>(commande?.origine ?? 'comptoir');
  const [modePaiement, setModePaiement] = useState<ModePaiement>(commande?.modePaiement ?? 'especes');
  const [lignes, setLignesEtat] = useState<LigneEcran[]>(() => (commande ? lignesDepuisCommande(commande) : []));
  // R64 : toute modification du bon passe par ici — une ligne de supplément par
  // personne (Pâte à sucre) reprend aussitôt les parts du gâteau qu'elle accompagne.
  const setLignes = useCallback(
    (maj: SetStateAction<LigneEcran[]>) =>
      setLignesEtat((ls) =>
        synchroniserSupplementsParPersonne(typeof maj === 'function' ? maj(ls) : maj, SUPPLEMENTS_PAR_PERSONNE, CORRESPONDANCES_COMPTOIR),
      ),
    [],
  );
  const [acompte, setAcompte] = useState<number | null>(commande ? commande.acompteCentimes : null);
  const [totalConvenu, setTotalConvenu] = useState<number | null>(() =>
    commande && commande.totalTarifCentimes != null && commande.totalCentimes < commande.totalTarifCentimes
      ? commande.totalCentimes
      : null,
  );
  const [remise, setRemise] = useState<Deverrouillage | null>(() =>
    commande?.remiseAutoriseePar && commande.remiseAutoriseeLe
      ? { par: commande.remiseAutoriseePar, le: commande.remiseAutoriseeLe }
      : null,
  );
  // Écriture et photo à imprimer : sur chaque ligne gâteau (lot 2, 28/10/2026).
  // La photo d'exemple envoyée sur WhatsApp reste au niveau de la commande.
  const [photoWhatsapp, setPhotoWhatsapp] = useState(commande?.photoWhatsapp ?? false);
  const [demandeInhabituelle, setDemandeInhabituelle] = useState(commande?.demandeInhabituelle ?? false);
  // Zone « dessin, précisions » sur les bons internes : seulement si demandée
  // (21/10/2026). Ancienne commande sans le champ : non.
  const [zoneDessin, setZoneDessin] = useState(commande?.zoneDessin === true);
  const [remarques, setRemarques] = useState(commande?.remarques ?? '');
  // « Annuler » (audit du 28/10/2026) : jamais jeter une saisie en un toucher.
  const [abandonOuvert, setAbandonOuvert] = useState(false);

  // --- Interface -----------------------------------------------------------
  const [actif, setActif] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [rayon, setRayon] = useState<string | null>(null);
  const [rayonsOuverts, setRayonsOuverts] = useState(false);
  const [eclair, setEclair] = useState<Eclair | null>(null);
  const [ligneDetail, setLigneDetail] = useState<string | null>(null);
  // Galerie de photos de modèles (26/10/2026) : montée seulement quand elle est
  // ouverte (aucune image chargée avant). Photo sans produit unique (bûches…) :
  // gardée en attente, posée sur le prochain produit touché (bandeau visible).
  const [galerieOuverte, setGalerieOuverte] = useState(false);
  const [photoEnAttente, setPhotoEnAttente] = useState<PhotoModele | null>(null);
  const fermerGalerie = useCallback(() => setGalerieOuverte(false), []);
  const [annonce, setAnnonce] = useState('');
  const etroit = useEcranEtroit();
  const [cotePave] = useCotePave();
  // Jour et heure de retrait : bande compacte toujours visible au-dessus des
  // produits (18/10/2026) — la date se choisit EN PREMIER, sans cacher la grille.
  const bandeRetrait = useRef<HTMLDivElement>(null);
  // Tablette : hauteur de l'espace de travail = écran − ce qui est au-dessus (mesuré).
  const cadre = useRef<HTMLDivElement>(null);
  const [hautCadre, setHautCadre] = useState<number | null>(null);
  const [tentative, setTentative] = useState(false);
  // Récapitulatif « Il manque… » au centre, ouvert par « Valider » (22/10/2026).
  const [recapOuvert, setRecapOuvert] = useState(false);
  const [refusServeur, setRefusServeur] = useState<Echec | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [validee, setValidee] = useState<Validee | null>(null);
  // Hors ligne (décision du propriétaire, 28/10/2026) : commande gardée sur la
  // tablette, envoyée au retour du réseau. Identifiant client unique et date de
  // prise posés au premier essai, gardés pour tous les suivants (jamais de doublon).
  const [gardee, setGardee] = useState(false);
  const idClient = useRef<string | null>(null);
  const priseLe = useRef<string | null>(null);
  // Commande refusée à l'arrivée, rouverte pour être corrigée (« ?reprise=… »).
  const [reprise, setReprise] = useState<CommandeEnAttente | null>(null);
  const [demande, setDemande] = useState<DemandeGerant | null>(null);
  const [parGerant, setParGerant] = useState<string | null>(null);
  const champClient = useRef<HTMLInputElement>(null);
  const zoneProduits = useRef<HTMLDivElement>(null);
  const zoneBon = useRef<HTMLDivElement>(null);

  // Date des PRIX : celle de la prise de commande (R4). En modification, la
  // date d'origine : une hausse de tarif depuis ne change rien pour le client.
  const datePrix = commande ? dateDuJour(new Date(commande.priseLe)) : null;

  const chargerCatalogue = useCallback(async (date: string) => {
    try {
      const r = await lireReponse<CatalogueCommande>(await fetch(`/api/tarifs?date=${encodeURIComponent(date)}`));
      if (r.ok) {
        memoireChargement.catalogues.set(date, r.donnees);
        setCatalogue(r.donnees);
      } else if (r.code === 'ERR_SERVEUR_INDISPONIBLE' && memoireValable() && memoireChargement.catalogues.has(date)) {
        setCatalogue(memoireChargement.catalogues.get(date)!);
      } else setRefusChargement(r);
    } catch {
      const enMemoire = memoireValable() ? memoireChargement.catalogues.get(date) : undefined;
      if (enMemoire) return setCatalogue(enMemoire);
      const e = echecReseau();
      if (!e.ok) setRefusChargement(e);
    }
  }, []);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const r = await lireReponse<ContexteCalendrier & { heure: string }>(await fetch('/api/calendrier'));
        if (annule) return;
        if (!r.ok) {
          if (r.code === 'ERR_SERVEUR_INDISPONIBLE' && memoireValable()) return utiliserMemoire();
          setRefusChargement(r);
          return;
        }
        memoireChargement.cal = r.donnees;
        memoireChargement.le = Date.now();
        setCal(r.donnees);
        await chargerCatalogue(datePrix ?? r.donnees.aujourdhui);
      } catch {
        if (annule) return;
        if (memoireValable()) return utiliserMemoire();
        const e = echecReseau();
        if (!e.ok) setRefusChargement(e);
      }
    })();
    // Hors ligne : le calendrier de la session, déjà reçu (voir `memoireChargement`).
    async function utiliserMemoire() {
      const c = memoireChargement.cal!;
      setCal(c);
      if (memoireChargement.options) setOptions(memoireChargement.options);
      await chargerCatalogue(datePrix ?? c.aujourdhui);
    }
    fetch('/api/gateaux')
      .then((r) => (r.ok ? r.json() : null))
      .then((o: OptionsGateau | null) => {
        if (!annule && o && Array.isArray(o.parfums)) {
          memoireChargement.options = o;
          setOptions(o);
        }
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [chargerCatalogue, datePrix]);

  useEffect(() => {
    if (prete && !vendeur) router.replace('/commandes');
  }, [prete, vendeur, router]);

  // « Rouvrir pour corriger » (voyant des commandes gardées) : la saisie gardée
  // revient telle quelle, avec le message du magasin à côté de « Valider ».
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('reprise');
    if (!id) return;
    window.history.replaceState(null, '', window.location.pathname);
    const c = trouverCommandeEnAttente(id);
    if (!c || c.etat !== 'a_reprendre') return;
    if (c.methode === 'PATCH' && c.commandeId !== commande?.id) return;
    const e = c.ecran as Partial<EcranGarde> | null;
    if (!e || !Array.isArray(e.lignes)) return;
    idClient.current = c.idClient;
    // Refusée parce que prise il y a trop longtemps : le vendeur a rappelé le
    // client et la reprend maintenant, la prise repart de maintenant (sinon
    // elle serait refusée à chaque envoi).
    priseLe.current = c.refus?.champ === 'priseLe' ? null : c.priseLe;
    setReprise(c);
    setClient(e.client ?? '');
    setTelephone(e.telephone ?? '');
    setDateRetrait(e.dateRetrait ?? null);
    setHeureRetrait(e.heureRetrait ?? '');
    if (e.origine) setOrigine(e.origine);
    if (e.modePaiement) setModePaiement(e.modePaiement);
    setLignes(e.lignes);
    setAcompte(e.acompte ?? null);
    setTotalConvenu(e.totalConvenu ?? null);
    setRemise(e.remise ?? null);
    setPhotoWhatsapp(e.photoWhatsapp === true);
    setDemandeInhabituelle(e.demandeInhabituelle === true);
    setZoneDessin(e.zoneDessin === true);
    setRemarques(e.remarques ?? '');
    setTentative(true);
    if (c.refus) setRefusServeur(echecDuServeur(c.refus));
  }, [commande?.id, setLignes]);

  // --- Domaine ---------------------------------------------------------------
  // Gâteaux au bon (R7, compté par le domaine sur les données, jamais par le
  // nom) : ils décident du bloc « Gâteau » et des suppléments au forfait.
  const famillesGateau = cal?.reglement.famillesGateau ?? FAMILLES_GATEAU;
  const nbGateaux = cal ? gateauxAuBon(lignes, catalogue, famillesGateau) : 0;
  const sansGateau = nbGateaux === 0;
  // R64 : la case « Pâte à sucre » est sous le gâteau qui la reçoit.
  const iPateASucre = cal ? indexGateauPateASucre(lignes, SUPPLEMENT_PATE_A_SUCRE, catalogue, famillesGateau, SUPPLEMENTS_PAR_PERSONNE) : null;

  const etat: EtatFormulaire = {
    client,
    telephone,
    dateRetrait,
    heureRetrait,
    lignes,
    acompteCentimes: acompte,
    totalConvenuCentimes: totalConvenu,
    remise,
    demandeInhabituelle,
  };

  const ctx: ContexteCommande | null = useMemo(() => {
    if (!cal || !catalogue) return null;
    return {
      resoudre: resoudreLocal(catalogue),
      joursFermes: cal.joursFermes,
      delais: cal.delais,
      reglement: cal.reglement,
      // R60 : gâteau sur commande au prix du comptoir (donnée du catalogue).
      correspondancesComptoir: CORRESPONDANCES_COMPTOIR,
      // R62 : goût obligatoire des gâteaux sur commande (donnée du catalogue).
      goutsSurCommande: GOUTS_SUR_COMMANDE,
      // R63 : forme carré / rond ; R65 : tailles qui ne se font pas (décisions du 26/10/2026).
      formes: REGLES_FORME,
      taillesInterdites: TAILLES_INTERDITES,
      // Écriture sur un gâteau = supplément Écriture au bon, toujours (28/10/2026).
      supplementEcriture: SUPPLEMENT_ECRITURE_DOMAINE,
      // Photo à imprimer sur un gâteau = supplément Photo, une fois par gâteau (28/10/2026).
      supplementPhoto: SUPPLEMENT_PHOTO,
      aujourdhui: cal.aujourdhui,
      existante: commande
        ? { statut: commande.statut, retraitLe: commande.retraitLe, anonymiseeLe: commande.anonymiseeLe }
        : null,
      joursAvantArchivage: JOURS_AVANT_ARCHIVAGE,
    };
  }, [cal, catalogue, commande]);

  const prise = cal && catalogue ? { datePrise: catalogue.date, heurePrise: cal.heure } : null;
  const saisie = prise ? versCommandeSaisie(etat, catalogue, prise) : null;

  const resultatsLignes: (Resultat<LigneControlee> | null)[] =
    saisie && ctx && prise
      ? lignes.map((l, i) =>
          // Pendant la saisie, une ligne sans quantité (taille pas encore choisie) n'est pas
          // jugée : pas de rouge prématuré. Dès « Valider », elle l'est, et son message
          // s'affiche sur la ligne (sinon la validation bloquait sans rien dire, 22/10/2026).
          l.quantite === null && l.produitId !== null && !tentative ? null : controlerLigne(saisie.lignes[i], i, prise.datePrise, ctx),
        )
      : lignes.map(() => null);
  // Commande prise avec l'ancien tarif (lignes hors catalogue, sans accord) et
  // pas de gérant : ses lignes ne passent pas le contrôle (accord manquant). Au
  // lieu d'un refus par ligne, UN refus si les produits changent ; sinon les
  // champs sans effet sur les prix s'enregistrent (le serveur revérifie).
  const ancienTarif = !!commande && parGerant === null && commande.lignes.some(estLigneAncienTarif);
  const sansAccord = (i: number | null) => i !== null && lignes[i]?.produitId === null && !lignes[i]?.deverrouillage;
  const blocagesDomaine: Echec[] = saisie && ctx ? blocagesCommande(saisie, ctx) : [];
  const blocages: Echec[] =
    ancienTarif && saisie
      ? [
          ...(lignesIdentiques(commande.lignes, saisie.lignes) ? [] : [refusAncienTarif()]),
          ...blocagesDomaine.filter((b) => !(b.code === 'ERR_DROIT_INSUFFISANT' && sansAccord(indexLigne(b.champ)))),
        ]
      : blocagesDomaine;
  const resultat = saisie && ctx && blocages.length === 0 ? controlerCommande(saisie, ctx) : null;
  const succesCommande = resultat?.ok ? resultat : null;

  const lignesOk = resultatsLignes.flatMap((r) => (r?.ok ? [r.donnees] : []));
  // Total pendant la saisie (audit du 28/10/2026) : lignes admises + lignes encore
  // refusées dont le montant se calcule (domaine) ; jamais présenté comme définitif
  // tant qu'une ligne n'est pas complète (« <montant> + à compléter »).
  const enCours = saisie && ctx && prise ? totalEnCours(saisie.lignes, prise.datePrise, ctx) : null;
  const totalTarif = enCours?.totalCentimes ?? 0;
  const total = succesCommande?.donnees.totalCentimes ?? totalConvenu ?? totalTarif;
  const totalComplet = succesCommande !== null || totalConvenu !== null || enCours === null || enCours.complet;
  const reste = resteDu(total, acompte ?? 0);
  const texteTotal = texteMontantEnCours(total, totalComplet);
  const texteReste = texteResteEnCours(reste, total, totalComplet);

  // Délai : première date possible, calculée par le domaine (jours ouvrés).
  const delai = lignesOk.length > 0 ? Math.max(...lignesOk.map((l) => l.delaiJoursOuvres)) : 0;
  const premiereDate =
    cal ? prochainJourOuvert(ajouterJoursOuvres(cal.aujourdhui, delai, cal.joursFermes) ?? cal.aujourdhui, cal.joursFermes) ?? undefined : undefined;

  // --- Signalements par zone --------------------------------------------------
  const tous: SignalementAffichable[] = [...blocages, ...(succesCommande?.signalements ?? [])];
  // Tout ce qui empêche de valider : refus de la commande et refus des lignes, sans doublon.
  const manques: SignalementAffichable[] = [];
  // Photo de la galerie qui attend son produit : la valider la perdrait sans un mot.
  const photoAttente = validerPhotoEnAttente(photoEnAttente?.id ?? null);
  for (const m of [
    ...blocages,
    ...resultatsLignes.flatMap((r) => (r && !r.ok ? [r] : [])),
    ...(photoAttente.ok ? [] : [photoAttente]),
  ]) {
    if (!manques.some((x) => x.code === m.code && x.champ === m.champ)) manques.push(m);
  }
  const pour = (champs: readonly string[]) => tous.filter((s) => champs.includes(champLocal(s.champ)) && indexLigne(s.champ) === null);
  const signauxClient = tentative ? pour(['client', 'telephone']) : pour(['telephone']).filter((s) => s.niveau !== 'bloquant' || telephone !== '');
  // Retrait le jour même ou le lendemain : ACCEPTÉ (LOI 11, 15/10 et 18/10/2026),
  // simple information « prévenir l'atelier » donnée par le domaine dès le choix de la date.
  const jourMeme = dateRetrait && cal ? validerJourMeme(dateRetrait, cal.aujourdhui, cal.joursFermes) : null;
  const lendemain = dateRetrait && cal ? validerLendemain(dateRetrait, cal.aujourdhui, cal.joursFermes) : null;
  const infoLendemain = [...(jourMeme?.ok ? jourMeme.signalements : []), ...(lendemain?.ok ? lendemain.signalements : [])];
  const signauxDateDomaine = dateRetrait || tentative ? pour(['dateRetrait', 'datePrise']) : [];
  const signauxDate = [
    ...signauxDateDomaine,
    ...infoLendemain.filter((i) => !signauxDateDomaine.some((s) => s.code === i.code)),
  ];
  const signauxHeure = (dateRetrait && (lignes.length > 0 || heureRetrait !== '')) || tentative ? pour(['heureRetrait', 'heurePrise']) : [];
  const signauxProduits = tentative || ancienTarif ? pour(['lignes']) : [];
  const signauxInhabituelle = pour(['demandeInhabituelle']);
  const signauxMontants = acompte !== null || tentative ? pour(['acompte', 'total']) : pour(['total']);
  const signauxStatut = pour(['statut']);
  // Champ du haut simplement vide (nom, téléphone, jour, heure) : phrase courte
  // JUSTE SOUS le champ, champ bordé de rouge, seulement après un premier
  // « Valider » ; elle disparaît dès que le champ est rempli (propriétaire, 28/10/2026).
  const estVideDuHaut = (s: SignalementAffichable) => MANQUE_SIMPLE.has(s.code) && CHAMPS_A_PHRASE.has(champLocal(s.champ)) && indexLigne(s.champ) === null;
  const videDe = (champ: string): SignalementAffichable | null =>
    tentative ? (tous.find((s) => estVideDuHaut(s) && champLocal(s.champ) === champ) ?? null) : null;
  const videNom = videDe('client');
  const videTelephone = videDe('telephone');
  const videJour = videDe('dateRetrait');
  const videHeure = videDe('heureRetrait');
  const sousLeChamp = (s: SignalementAffichable | null): ReactNode =>
    s ? (
      <p data-niveau="bloquant" data-champ={s.champ ?? undefined} className="mt-1 text-sm text-alerte">
        {texteChampVide(s)}
      </p>
    ) : null;
  const refusClient = signauxClient.filter((s) => !estVideDuHaut(s));

  // Suppléments Écriture et Photo : un par gâteau qui porte une écriture / une
  // photo à imprimer, remis s'ils manquent (gâteau retiré puis remis, ligne
  // retirée…), ajustés quand un gâteau change ; jamais retirés à la main
  // (propriétaire, 28/10/2026). Même tableau si rien ne change.
  useEffect(() => {
    if (!catalogue) return;
    setLignes((ls) => synchroniserSupplementsGateau(ls, catalogue, famillesGateau));
  }, [lignes, catalogue, famillesGateau, setLignes]);

  // --- Actions -----------------------------------------------------------------
  // Un goût changé APRÈS la taille : la ligne passe au gâteau du comptoir de ce
  // goût (Bavarois framboise 6P), ou revient au Bavarois 6P (28/10/2026).
  const majLigne = (i: number, partiel: Partial<LigneEcran>) =>
    setLignes((ls) =>
      ls.map((l, j) => {
        if (j !== i) return l;
        const suivante = majLigneEcran(l, partiel);
        return 'gouts' in partiel ? suivreGout(suivante, catalogue, CORRESPONDANCES_COMPTOIR) : suivante;
      }),
    );
  // Chaque gâteau a son bloc « Sur le gâteau », sous sa ligne : sur tablette,
  // hors de vue une fois la taille et le goût affichés (28/10/2026). Tous les
  // goûts de CE gâteau choisis : son écriture est l'étape suivante, on la fait venir.
  const montrerEcriture = (cle: string) =>
    requestAnimationFrame(() =>
      document.getElementById(`sur-gateau-${cle}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  const retirerLigne = (i: number) => setLignes((ls) => ls.filter((_, j) => j !== i));
  /** R63 / R65 : la ligne devient le produit proposé par le domaine (un geste). */
  const remplacer = (i: number, r: SortieRemplacement) =>
    setLignes((ls) => ls.map((l, j) => (j === i ? appliquerRemplacement(l, r, GOUTS_SUR_COMMANDE, CORRESPONDANCES_COMPTOIR) : l)));
  /** Goûts attendus sur une ligne : donnée du gâteau commandé, ou 1 pour un gâteau libre. */
  const goutsDeLaLigne = (l: LigneEcran): number => {
    if (l.produitId === null) return l.gateauLibre === true ? 1 : 0;
    const f = ficheDe(catalogue, gateauDeLaLigne(l));
    return f ? goutsAttendus(GOUTS_SUR_COMMANDE[f.produit.id], f) : 0;
  };
  /** Amène une ligne du bon à l'écran (champ simplement vide : rien à « corriger » d'autre). */
  const montrerLigne = (i: number) =>
    document.getElementById(`bon-${lignes[i]?.cle ?? ''}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const avecGerant = (raison: string, appliquer: (d: Deverrouillage) => void) => {
    if (parGerant !== null) {
      appliquer({ par: parGerant, le: new Date().toISOString() });
      return;
    }
    setDemande({ raison, appliquer });
  };

  /**
   * Un toucher = +1 (pièces ou parts) ; au kilo : pavé du poids. Le domaine juge la ligne aussitôt.
   * Avec une photo de modèle (galerie, ou photo en attente) : même ajout, la
   * ligne retient l'identifiant de la photo (src/components/commande/galerie.ts).
   */
  const toucher = (f: FicheCatalogue, photoChoisie?: PhotoModele) => {
    // Photo en attente : posée sur le prochain produit touché, jamais sur un supplément.
    const photo = photoChoisie ?? (photoEnAttente && !estSupplement(f) ? photoEnAttente : undefined);
    if (photo && photo === photoEnAttente) setPhotoEnAttente(null);
    const t = photo
      ? ajouterAvecPhoto(lignes, f, photo, catalogue, famillesGateau, SUPPLEMENTS_PAR_PERSONNE, CORRESPONDANCES_COMPTOIR)
      : toucherProduit(lignes, f, famillesGateau);
    setLignes(t.lignes);
    setActif(`${t.cle}.${t.champ}`);
    setEclair((e) => ({ cle: t.cle, produitId: f.produit.id, n: (e?.n ?? 0) + 1 }));
    const ligne = t.lignes.find((l) => l.cle === t.cle);
    const fiche = ficheDe(catalogue, f.produit.id);
    // Une ligne par gâteau (28/10/2026) : « nouveau gâteau », jamais « 2 ».
    const gateauxDuProduit = t.lignes.filter((l) => l.produitId === f.produit.id).length;
    setAnnonce(
      (photo ? `Photo ${photo.id} — ` : '') +
      (t.champ === 'gateau'
        ? gateauxDuProduit > 1
          ? `${libelleProduit(f)} : un gâteau de plus au bon (${gateauxDuProduit} en tout, chacun sa ligne)`
          : `${libelleProduit(f)} : 1 gâteau au bon`
        : t.champ === 'taille'
        ? f.prix.minParSymbole !== null && ligne?.nbSymboles == null
          ? `${libelleProduit(f)} au bon\u00a0: combien de chiffres ou lettres\u00a0?`
          : `${libelleProduit(f)} au bon\u00a0: choisissez la taille`
        : ligne?.quantite != null && f.produit.unite !== 'kg'
          ? `${libelleProduit(f)}\u00a0: ${ligne.quantite} ${uniteDe(fiche)} au bon`
          : `${libelleProduit(f)} ajouté au bon\u00a0: saisissez le poids`),
    );
  };

  /**
   * Toucher d'une photo de la galerie. La galerie se ferme toujours (retour
   * visible immédiat : la ligne s'allume dans le bon). Photo d'un produit au
   * tarif : ajouté comme un toucher de sa carte. Sinon (plusieurs tailles
   * possibles, ou produit absent du tarif de cette commande) : la grille montre
   * les produits possibles et la photo attend le prochain produit touché.
   */
  const choisirPhoto = (p: PhotoModele) => {
    setGalerieOuverte(false);
    const f = ficheDePhoto(catalogue, p);
    if (f) {
      setPhotoEnAttente(null);
      toucher(f, p);
      return;
    }
    const nav = navigationPourPhoto(p);
    setPhotoEnAttente(p);
    setRecherche(nav.recherche);
    setRayon(null);
    setAnnonce(`Photo ${p.id} retenue. ${nav.consigne}.`);
    if (etroit) zoneProduits.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else zoneProduits.current?.scrollTo({ top: 0 });
  };

  const ajouterLigneLibre = () => {
    const ligne = ligneVide(null);
    ligne.libelleLibre = recherche.trim();
    setLignes((ls) => [...ls, ligne]);
    setActif(`${ligne.cle}.quantite`);
    setLigneDetail(ligne.cle);
    setEclair((e) => ({ cle: ligne.cle, produitId: null, n: (e?.n ?? 0) + 1 }));
    setAnnonce('Autre demande ajoutée au bon');
    setRecherche('');
  };

  // Surbrillance brève (ni son ni fenêtre) : elle s'éteint seule.
  useEffect(() => {
    if (!eclair) return;
    const t = window.setTimeout(() => setEclair(null), 1200);
    return () => window.clearTimeout(t);
  }, [eclair]);

  // Tablette : la ligne touchée est amenée à l'écran DANS la colonne du bon
  // (défilement interne, la page ne bouge pas). Téléphone : on ne bouge pas la
  // page — la pastille sur la carte produit suffit, les produits restent sous le doigt.
  useEffect(() => {
    if (!eclair || etroit) return;
    document.getElementById(`bon-${eclair.cle}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [eclair, etroit]);

  // Tablette : l'espace de travail tient exactement dans l'écran (aucun
  // défilement de la page) ; seules la grille et la colonne du bon défilent.
  // Sa hauteur = 100dvh − position de son bord haut (barre de navigation
  // comprise, mesurée : elle peut passer sur deux lignes).
  const pret = cal !== null && catalogue !== null;
  useLayoutEffect(() => {
    const el = cadre.current;
    if (etroit || !pret || !el) return;
    const mesurer = () => setHautCadre(el.getBoundingClientRect().top + window.scrollY);
    mesurer();
    window.addEventListener('resize', mesurer);
    const barre = document.querySelector('[data-barre-navigation]');
    const obs = barre && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mesurer) : null;
    if (barre) obs?.observe(barre);
    return () => {
      window.removeEventListener('resize', mesurer);
      obs?.disconnect();
    };
  }, [etroit, pret]);

  /** Applique la sortie proposée par le domaine (un geste). */
  const corriger = (s: SignalementAffichable, v: unknown) => {
    const i = indexLigne(s.champ);
    const champ = champLocal(s.champ);
    const ligne = i !== null ? lignes[i] : undefined;

    // Retrait le lendemain : accepté sans le gérant (LOI 11, 15/10/2026) — plus d'accord demandé ici.
    if (s.code === 'ERR_DROIT_INSUFFISANT') {
      if (i === null && champ === 'lignes') {
        // Commande prise avec l'ancien tarif : le gérant ouvre son accès, puis accorde chaque ligne.
        setDemande({ raison: 'Commande prise avec l’ancien tarif\u00a0: le code du manager est nécessaire pour la modifier, s’il vous plaît.', appliquer: () => {} });
      } else if (ligne && ligne.produitId === null) {
        avecGerant(`Prix d’une demande hors catalogue\u00a0: «\u00a0${ligne.libelleLibre || 'ligne libre'}\u00a0».`, (d) =>
          majLigne(i!, { deverrouillage: d }),
        );
      } else {
        setParGerant(null);
        setDemande({ raison: 'L’accès manager a expiré\u00a0: ressaisissez le code, s’il vous plaît, puis validez à nouveau.', appliquer: () => {} });
      }
      return;
    }
    // Photo en attente d'un produit : la sortie la retire (rien d'autre ne change).
    if (s.code === 'ERR_PHOTO_EN_ATTENTE') return setPhotoEnAttente(null);
    // Une ligne par gâteau (28/10/2026) : « Séparer en N gâteaux », chacun sa ligne.
    if (i !== null && ligne && estSeparationProposee(v ?? s.valeurProposee)) {
      const cle = ligne.cle;
      return setLignes((ls) => synchroniserSupplementsGateau(separerLigneGateau(ls, cle), catalogue, famillesGateau));
    }
    // « Autre demande » pas encore décrite : on amène au champ, jamais retirer la ligne.
    if (i !== null && ligne && champ === 'libelle') {
      montrerLigne(i);
      document.getElementById(`libelle-${ligne.cle}`)?.focus();
      return;
    }
    // Photo de modèle refusée (identifiant inconnu) : on retire la photo, jamais la ligne.
    if (i !== null && ligne && champ === 'photoModele') return setLignes((ls) => retirerPhoto(ls, ligne.cle));
    if (i !== null && ligne && s.code === 'ERR_GOUT_MANQUANT') {
      // R62 : « Au choix du pâtissier » sur chaque goût encore vide (jamais retirer la ligne).
      const n = goutsDeLaLigne(ligne);
      return majLigne(i, { gouts: Array.from({ length: n }, (_, k) => ligne.gouts[k] || GOUT_AU_CHOIX) });
    }
    // Ligne libre : « C'est un gâteau ? » se répond sur la ligne (jamais la retirer).
    if (i !== null && ligne && champ === 'gateauLibre') return montrerLigne(i);
    // Écriture / photo à imprimer sans son supplément (28/10/2026) : la sortie
    // met le supplément au bon, une fois par gâteau qui en porte.
    if (s.code === 'ERR_ECRITURE_SANS_SUPPLEMENT' || s.code === 'ERR_PHOTO_SANS_SUPPLEMENT') {
      return setLignes((ls) => synchroniserSupplementsGateau(ls, catalogue, famillesGateau));
    }
    // R63 : forme du gâteau — jamais retirer la ligne. Rond impossible → carré
    // (les remplaçants ont leurs propres boutons) ; forme illisible → à rechoisir.
    if (i !== null && ligne && s.code === 'ERR_FORME_ROND_IMPOSSIBLE') return majLigne(i, { forme: 'carre' });
    if (i !== null && ligne && champ === 'forme') {
      if (s.code === 'ERR_SAISIE_INVALIDE') majLigne(i, { forme: null });
      return montrerLigne(i);
    }
    // R65 : taille qui ne se fait pas → premier remplaçant ; aucun → retour aux produits.
    if (i !== null && ligne && s.code === 'ERR_TAILLE_INTERDITE') {
      const [premier] = remplacementsProposes(v ?? s.valeurProposee);
      if (premier) return remplacer(i, premier);
      if (etroit) zoneProduits.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else zoneProduits.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (i !== null && ligne) {
      // Supplément sans gâteau, ou plus aucune place pour ce supplément : la sortie retire la ligne.
      if (
        s.code === 'ERR_SUPPLEMENT_SANS_GATEAU' ||
        ((s.code === 'ERR_SUPPLEMENT_TROP_NOMBREUX' || s.code === 'ERR_SUPPLEMENT_EN_TROP') && v === 0)
      ) {
        return retirerLigne(i);
      }
      // R60 : la taille existe au comptoir → la ligne devient le gâteau du comptoir.
      if (s.code === 'ERR_PRIX_COMPTOIR' && ligne.quantite !== null) {
        // Ligne déjà au comptoir mais pas au bon goût : sa taille, pas sa quantité 1.
        const parts = tailleChoisie(ligne, CORRESPONDANCES_COMPTOIR) ?? ligne.quantite;
        return setLignes((ls) => ls.map((l, j) => (j === i ? choisirTaille(l, parts, catalogue, CORRESPONDANCES_COMPTOIR) : l)));
      }
      if ((champ === 'quantite') && typeof v === 'number') return majLigne(i, { quantite: v });
      if (s.code === 'ERR_SOUS_PLANCHER' && typeof v === 'number') return majLigne(i, { prixUnitaireCentimes: v, deverrouillage: null });
      if (s.code === 'ERR_NB_SYMBOLES_MANQUANT') return setActif(`${ligne.cle}.symboles`);
      if (s.code === 'ERR_MONTANT_NUL') return setActif(`${ligne.cle}.${ligne.produitId ? 'quantite' : 'prix'}`);
      if (s.code === 'ERR_QUANTITE_INVALIDE') return setActif(`${ligne.cle}.quantite`);
      if (s.code === 'AVERT_PRODUIT_EN_DOUBLE' && Array.isArray(v)) return fusionner(v as number[]);
      if (s.code === 'ERR_TARIF_INCOHERENT' || s.code === 'ERR_UNITE_INCOHERENTE') {
        if (catalogue) void chargerCatalogue(catalogue.date);
        return;
      }
      return retirerLigne(i); // ligne sans produit, produit inconnu / sans tarif / sans régime
    }
    switch (champ) {
      case 'dateRetrait':
        if (typeof v === 'string') setDateRetrait(v);
        return;
      case 'heureRetrait':
        if (typeof v === 'string') setHeureRetrait(v);
        else bandeRetrait.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      case 'acompte':
        if (typeof v === 'number') setAcompte(v);
        else setActif('acompte');
        return;
      case 'total':
        setTotalConvenu(null);
        setRemise(null);
        return;
      case 'client':
        champClient.current?.focus();
        return;
      case 'telephone':
        setActif('telephone');
        return;
      case 'lignes':
        if (etroit) zoneProduits.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else zoneProduits.current?.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      case 'statut':
        router.push('/commandes/nouvelle');
        return;
      default:
        if (s.code === 'ERR_SERVEUR_INDISPONIBLE' || s.code === 'ERR_INATTENDUE') void valider();
        else if (s.code === 'ERR_DONNEE_INTROUVABLE' || s.code === 'ERR_DEJA_ENREGISTRE') window.location.reload();
    }
  };

  /** « Fusionner les lignes » : quantités additionnées sur la première, les autres retirées. */
  const fusionner = (indices: number[]) => {
    const [premier, ...autres] = indices;
    const quantites = indices.map((k) => lignes[k]?.quantite ?? 0);
    setLignes((ls) =>
      ls
        .map((l, j) => (j === premier ? { ...l, quantite: somme(quantites) } : l))
        .filter((_, j) => !autres.includes(j)),
    );
  };

  /** Liste de signalements avec leurs sorties (bouton qui corrige / action / issue de secours). */
  // Champ simplement vide (nom, heure, taille, goût…) : la fenêtre « Il manque… » le
  // dit ; sous le champ, juste « ▲ À remplir » (propriétaire, 22/10/2026). Les refus
  // de règle (mardi, minimum…) gardent leur message et leur bouton sur place.
  const rendre = (liste: readonly SignalementAffichable[], unite = 'pièces', prefixe?: string): ReactNode => {
    const vides = liste.filter((s) => estManqueSimple(s));
    const autres = liste.filter((s) => !estManqueSimple(s));
    return (
      <>
        {vides.map((s) => (
          <p
            key={`${s.code}|${s.champ ?? ''}`}
            data-niveau="bloquant"
            data-champ={s.champ ?? undefined}
            className="mt-1 text-sm text-alerte"
          >
            {texteChampVide(s)}
          </p>
        ))}
        {rendreRefus(autres, unite, prefixe)}
      </>
    );
  };
  const rendreRefus = (liste: readonly SignalementAffichable[], unite = 'pièces', prefixe?: string): ReactNode =>
    liste.length === 0 ? null : (
      <ListeSignalements
        className="mt-3"
        compact
        prefixeId={prefixe}
        signalements={liste}
        libelleCorrectionPour={(s) => {
          // Taille hors standard : DEUX sorties (dessous / dessus), rendues plus bas.
          // Goût manquant (R62) : sortie « Au choix du pâtissier », rendue plus bas.
          // Rond impossible (R63), taille qui ne se fait pas (R65) : UN bouton par sortie, plus bas.
          if (
            s.code === 'ERR_TAILLE_NON_STANDARD' ||
            s.code === 'ERR_GOUT_MANQUANT' ||
            s.code === 'ERR_FORME_ROND_IMPOSSIBLE' ||
            s.code === 'ERR_TAILLE_INTERDITE'
          ) {
            return undefined;
          }
          // Une ligne par gâteau : « Séparer en N gâteaux » (texte du domaine).
          if (estSeparationProposee(s.valeurProposee)) return libelleSeparation(s.valeurProposee.separerEn);
          const so = sortieDe(s, unite);
          return so.avecValeur ? so.libelle : undefined;
        }}
        onCorriger={corriger}
        autreSortiePour={(s) => {
          const so = sortieDe(s, unite);
          const boutons: ReactNode[] = [];
          const iLigne = indexLigne(s.champ);
          // R62 : goût manquant → « Au choix du pâtissier » sur chaque goût encore vide.
          if (s.code === 'ERR_GOUT_MANQUANT' && iLigne !== null) {
            const l = lignes[iLigne];
            const n = l ? goutsDeLaLigne(l) : 0;
            boutons.push(
              <BoutonSortie
                key="gout-au-choix"
                onClick={() =>
                  majLigne(iLigne, { gouts: Array.from({ length: n }, (_, k) => l?.gouts[k] || GOUT_AU_CHOIX) })
                }
              >
                {GOUT_AU_CHOIX}
              </BoutonSortie>,
            );
          }
          // R63 : rond au-dessus du seuil → « Passer en carré », puis « Passer en Layer
          // Cake (20 parts) » (remplaçants du domaine, texte du catalogue des messages).
          // R65 : « Passer en Matadi chocolat 6P », « Prendre Mousse chocolat 4P ».
          if ((s.code === 'ERR_FORME_ROND_IMPOSSIBLE' || s.code === 'ERR_TAILLE_INTERDITE') && iLigne !== null) {
            if (s.code === 'ERR_FORME_ROND_IMPOSSIBLE') {
              boutons.push(
                <BoutonSortie key="carre" onClick={() => majLigne(iLigne, { forme: 'carre' })}>
                  {so.libelle ?? LIBELLES_FORME.carre}
                </BoutonSortie>,
              );
            }
            const remplacements = remplacementsProposes(s.valeurProposee);
            for (const r of remplacements) {
              boutons.push(
                <BoutonSortie key={`remplacer-${r.produitId}`} onClick={() => remplacer(iLigne, r)}>
                  {r.bouton}
                </BoutonSortie>,
              );
            }
            if (s.code === 'ERR_TAILLE_INTERDITE' && remplacements.length === 0 && so.libelle) {
              boutons.push(
                <BoutonSortie key="autre-produit" onClick={() => corriger(s, [])}>
                  {so.libelle}
                </BoutonSortie>,
              );
            }
            return <>{boutons}</>;
          }
          // R64 : Pâte à sucre sur un gâteau qui ne la reçoit pas ENCORE (gâteau du
          // comptoir à 6 parts, rond, sous le minimum) : en plus de « Supprimer la
          // ligne », le gâteau passe au minimum de parts de la donnée (carré d'office).
          if (s.code === 'ERR_SUPPLEMENT_NON_ADMIS' && iLigne !== null) {
            const cleSupplement = lignes[iLigne]?.produitId ?? '';
            const regle = SUPPLEMENTS_PAR_PERSONNE[cleSupplement];
            const g = regle ? lignes.findIndex((l) => { const c = gateauDeLaLigne(l); return c !== null && c !== cleSupplement && regle.gateaux.includes(c); }) : -1;
            if (regle && g >= 0 && Number.isSafeInteger(regle.partsMin) && regle.partsMin > 0) {
              const min = regle.partsMin;
              boutons.push(
                <BoutonSortie
                  key="passer-au-minimum"
                  onClick={() =>
                    setLignes((ls) =>
                      ls.map((l, j) => (j === g ? { ...choisirTaille(l, min, catalogue, CORRESPONDANCES_COMPTOIR), forme: null } : l)),
                    )
                  }
                >
                  {sortieDe({ ...s, code: 'ERR_QUANTITE_MIN', valeurProposee: min }, 'parts').libelle ?? `${min}`}
                </BoutonSortie>,
              );
            }
          }
          // LOI 11 : taille de gâteau hors standard. Les deux tailles standard les
          // plus proches (jamais une seule : on ne pousse pas le vendeur vers le
          // haut), puis l'exception par le code gérant, tracée sur la ligne.
          if (s.code === 'ERR_TAILLE_NON_STANDARD' && iLigne !== null && cal) {
            const parts = lignes[iLigne]?.quantite ?? 0;
            const { inferieure, superieure } = taillesProches(parts, cal.reglement.taillesGateau);
            for (const t of [inferieure, superieure]) {
              if (t === null) continue;
              boutons.push(
                <BoutonSortie key={`taille-${t}`} onClick={() => majLigne(iLigne, { quantite: t })}>
                  {sortieDe({ ...s, valeurProposee: t }, unite).libelle ?? `${t}`}
                </BoutonSortie>,
              );
            }
            boutons.push(
              <BoutonSortie
                key="gerant"
                onClick={() =>
                  avecGerant(`Gâteau en ${parts} parts, hors des tailles standard.`, (d) =>
                    majLigne(iLigne, { deverrouillageTaille: d }),
                  )
                }
              >
                {libelleCorrection('ERR_DROIT_INSUFFISANT', { action: '', role: 'manager' })}
              </BoutonSortie>,
            );
            return <>{boutons}</>;
          }
          // Photo de modèle refusée (inconnue, ou retirée de la galerie par le gérant) :
          // la sortie retire la photo, jamais la ligne (voir `corriger`).
          if (champLocal(s.champ) === 'photoModele' && iLigne !== null && lignes[iLigne]?.photoModele) {
            boutons.push(
              <BoutonSortie key="retirer-photo" onClick={() => corriger(s, null)}>
                Retirer la photo
              </BoutonSortie>,
            );
            return <>{boutons}</>;
          }
          if (so.libelle && !so.avecValeur) {
            boutons.push(
              <BoutonSortie key="action" onClick={() => corriger(s, undefined)}>
                {so.libelle}
              </BoutonSortie>,
            );
          }
          // Sous le plancher : l'autre sortie est l'accord du gérant.
          if (s.code === 'ERR_SOUS_PLANCHER' && iLigne !== null) {
            boutons.push(
              <BoutonSortie
                key="gerant"
                onClick={() =>
                  avecGerant('Prix par personne sous le prix « à partir de ».', (d) => majLigne(iLigne, { deverrouillage: d }))
                }
              >
                {libelleCorrection('ERR_DROIT_INSUFFISANT', { action: '', role: 'manager' })}
              </BoutonSortie>,
            );
          }
          if (so.autre) {
            boutons.push(
              <span key="autre" className="inline-flex min-h-14 items-center rounded-xl border-2 border-line-fort px-4 text-base text-ink">
                {so.autre}
              </span>,
            );
          }
          return boutons.length > 0 ? <>{boutons}</> : undefined;
        }}
      />
    );

  // « Annuler » : commande vide (ou modification inchangée) → on part ; sinon
  // une petite fenêtre demande confirmation (« Continuer la commande » par défaut).
  const empreinte = () =>
    empreinteSaisie({
      client,
      telephone,
      dateRetrait,
      heureRetrait,
      origine,
      modePaiement,
      lignes,
      acompte,
      totalConvenu,
      photoWhatsapp,
      demandeInhabituelle,
      zoneDessin,
      remarques,
    });
  const [empreinteInitiale] = useState(() =>
    commande
      ? empreinteSaisie({
          client: commande.client,
          telephone: commande.telephone,
          dateRetrait: commande.retraitLe,
          heureRetrait: commande.retraitHeure ?? '',
          origine: commande.origine,
          modePaiement: commande.modePaiement,
          lignes: synchroniserSupplementsParPersonne(lignesDepuisCommande(commande), SUPPLEMENTS_PAR_PERSONNE, CORRESPONDANCES_COMPTOIR),
          acompte: commande.acompteCentimes,
          totalConvenu,
          photoWhatsapp: commande.photoWhatsapp ?? false,
          demandeInhabituelle: commande.demandeInhabituelle ?? false,
          zoneDessin: commande.zoneDessin === true,
          remarques: commande.remarques ?? '',
        })
      : null,
  );
  const annuler = () => {
    const aPerdre = modification ? empreinte() !== empreinteInitiale : saisieEntamee({ client, telephone, lignes, remarques });
    if (aPerdre) setAbandonOuvert(true);
    else router.push('/commandes');
  };

  const valider = async () => {
    setTentative(true);
    setRefusServeur(null);
    setActif(null);
    // Une ligne incomplète (taille non choisie) bloque aussi, même si `blocages` ne la cite pas encore.
    const incomplete = lignes.some((l) => l.quantite === null && l.produitId !== null);
    if (!saisie || blocages.length > 0 || incomplete || photoEnAttente !== null) {
      // Tout ce qui manque, d'un coup, au centre de l'écran.
      setRecapOuvert(true);
      return;
    }
    setEnvoi(true);
    try {
      idClient.current ??= nouvelIdCommande();
      priseLe.current ??= new Date().toISOString();
      const corps = {
        // Commande reprise : elle reste au nom de qui l'a prise, à l'heure où elle l'a été.
        ...(modification ? { id: commande.id, action: 'modification', auteur: vendeur } : { vendeur: reprise?.vendeur ?? vendeur }),
        // Horodatage de la tablette (hors ligne, l'envoi peut arriver bien plus tard).
        priseLe: priseLe.current,
        client,
        telephone,
        origine,
        modePaiement,
        dateRetrait,
        heureRetrait: heureRetrait || null,
        acompteCentimes: acompte ?? 0,
        totalConvenuCentimes: totalConvenu,
        remise,
        // Écriture et photo à imprimer : dans chaque ligne (`saisie.lignes`, lot 2).
        photoWhatsapp,
        demandeInhabituelle,
        zoneDessin,
        remarques: remarques || null,
        lignes: lignes.map((l, i) => ({
          ...saisie.lignes[i],
          precision: l.precision || null,
          formes: l.formes.trim() || null,
          decorations: l.decorations,
          photoModele: l.photoModele ?? null,
        })),
      };
      const methode = modification ? 'PATCH' : 'POST';
      const lu = await envoyerAuServeur(methode, corps, idClient.current);
      if (aGarderSurLaTablette(lu)) {
        // Pas de réseau (ou serveur injoignable) : gardée sur la tablette, partira toute seule.
        const ecran: EcranGarde = {
          client,
          telephone,
          dateRetrait,
          heureRetrait,
          origine,
          modePaiement,
          lignes,
          acompte,
          totalConvenu,
          remise,
          photoWhatsapp,
          demandeInhabituelle,
          zoneDessin,
          remarques,
        };
        const ok = garderCommande({
          idClient: idClient.current,
          methode,
          commandeId: commande?.id ?? null,
          numero: commande?.numero ?? null,
          client,
          dateRetrait,
          heureRetrait: heureRetrait || null,
          vendeur: reprise?.vendeur ?? vendeur ?? '',
          priseLe: priseLe.current,
          corps,
          ecran,
        });
        if (ok) {
          setGardee(true);
          window.scrollTo({ top: 0 });
        } else {
          const e = echecReseau();
          if (!e.ok) setRefusServeur({ ...e, message: TEXTES_HORS_LIGNE.stockageIndisponible });
        }
        return;
      }
      if (lu.type === 'reponse' && !lu.ok) {
        // Refus du magasin (règle rejouée, accord du manager…) : affiché comme avant, rien n'est gardé.
        if (lu.refus.code === 'ERR_DROIT_INSUFFISANT') setParGerant(null);
        setRefusServeur(echecDuServeur(lu.refus));
        return;
      }
      const issue = classerReponse(lu);
      const donnees = (lu.type === 'reponse' && lu.ok ? lu.donnees : null) as { id: number; numero: string } | null;
      // Reprise corrigée et acceptée : elle sort de la file des commandes à reprendre.
      if (reprise && issue.type === 'envoyee') noterIssue(reprise.idClient, issue);
      setValidee({ id: donnees?.id ?? 0, numero: donnees?.numero ?? '', controlee: succesCommande?.donnees ?? null });
      window.scrollTo({ top: 0 });
    } catch {
      const e = echecReseau();
      if (!e.ok) setRefusServeur(e);
    } finally {
      setEnvoi(false);
    }
  };

  /* ---------------------------------------------------------------- Rendu */

  if (!prete || !vendeur) return null;

  if (gardee) {
    return (
      <CommandeGardee
        modification={modification}
        client={client}
        dateRetrait={dateRetrait}
        heureRetrait={heureRetrait}
        controlee={succesCommande?.donnees ?? null}
        onNouvelle={() => (modification ? router.push('/commandes/nouvelle') : onRecommencer())}
        onAccueil={() => router.push('/')}
      />
    );
  }

  if (validee) {
    return (
      <Confirmation
        validee={validee}
        modification={modification}
        client={client}
        dateRetrait={dateRetrait}
        heureRetrait={heureRetrait}
        // replace : « ← Retour » de l'impression ne ramène pas sur un formulaire vidé.
        onImprimer={() => router.replace(`/commandes/${validee.id}/imprimer`)}
        onNouvelle={() => router.push('/commandes')}
        // La commande est enregistrée : y revenir l'ouvre en modification (jamais un doublon).
        onRevoir={() => router.replace(`/commandes/${validee.id}/modifier`)}
      />
    );
  }

  const chargement = !refusChargement && (!cal || !catalogue);


  /** Le pavé ouvert (un seul à la fois), affiché dans la colonne du pavé. */
  const paveOuvert = (): ReactNode | null => {
    if (!actif || !cal) return null;
    if (actif === 'telephone') {
      return <PaveTelephone libelle="Téléphone du client" telephone={telephone} onChange={setTelephone} onValider={() => setActif(null)} />;
    }
    if (actif === 'acompte') {
      return (
        <PaveMontant
          libelle="Acompte versé"
          sousTitre={`au moins ${cal.reglement.acomptePourcentageMin}\u00a0% du total`}
          centimes={acompte}
          onChange={setAcompte}
          onValider={() => setActif(null)}
          champ="acompte"
        />
      );
    }
    if (actif === 'total') {
      return remise ? (
        <PaveMontant
          libelle="Prix convenu avec le client"
          sousTitre={`Tarif\u00a0: ${formaterEuros(totalTarif)}${totalComplet ? '' : ' + à compléter'}`}
          centimes={totalConvenu}
          onChange={setTotalConvenu}
          onValider={() => setActif(null)}
          champ="total"
        />
      ) : null;
    }
    const point = actif.indexOf('.');
    if (point < 0) return null;
    const cle = actif.slice(0, point);
    const champ = actif.slice(point + 1);
    const i = lignes.findIndex((l) => l.cle === cle);
    // « taille » : choix aux boutons des tailles standard, sur la ligne (pas de pavé).
    if (i < 0 || champ === 'taille') return null;
    return (
      <PaveDeLigne
        ligne={lignes[i]}
        fiche={ficheDe(catalogue, lignes[i].produitId)}
        champ={champ}
        onChange={(p) => majLigne(i, p)}
        ouvrir={(c) => setActif(c === null ? null : `${cle}.${c}`)}
      />
    );
  };
  const pave = paveOuvert();
  const blocPave = pave ? (
    <div key={actif ?? ''} className="grid gap-1">
      {pave}
      <button type="button" onClick={() => setActif(null)} className="min-h-12 rounded-xl text-sm text-ink-2 underline underline-offset-2">
        Fermer le pavé
      </button>
    </div>
  ) : null;

  /* ------------------------------------ Bloc « Sur le gâteau » (sous CHAQUE gâteau) */
  // Lot 2 (propriétaire, 28/10/2026 : « une écriture par gâteau, ça doit être
  // clair quelle écriture pour quel gâteau ») : chaque gâteau a son écriture,
  // son « Pas d'écriture » et sa photo à imprimer. Écrire / cocher met le
  // supplément au bon, une fois par gâteau ; vider / décocher le retire.
  const surLeGateau = (cle: string, saisie: Parameters<typeof saisirSurLeGateau>[2]) =>
    setLignes((ls) => saisirSurLeGateau(ls, cle, saisie, catalogue, famillesGateau));
  const photoAuTarif = ficheDe(catalogue, SUPPLEMENT_PHOTO) !== null;
  // R64 : prix par personne LU au catalogue reçu (date de prise), jamais écrit ici.
  const ficheSucre = ficheDe(catalogue, SUPPLEMENT_PATE_A_SUCRE);
  const blocGateauDe = (ligne: LigneEcran, i: number, signaux: readonly SignalementAffichable[]) => {
    const sansEcriture = ligne.sansEcriture === true;
    const texteGateau = sansEcriture ? '' : (ligne.texteGateau ?? '');
    const photoImprimee = ligne.photoImprimee === true;
    return (
      <div
        id={`sur-gateau-${ligne.cle}`}
        style={{ scrollMarginTop: 8 }}
        role="group"
        aria-label="Sur ce gâteau"
        className="mt-2 rounded-lg border-l-4 border-accent bg-surface-2 px-2.5 pb-1.5 pt-2"
      >
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">Écriture sur ce gâteau</span>
          <input
            className={CHAMP_TEXTE}
            value={texteGateau}
            disabled={sansEcriture}
            onChange={(e) => surLeGateau(ligne.cle, { texteGateau: e.target.value })}
            placeholder={sansEcriture ? 'Pas d’écriture' : 'JOYEUX ANNIVERSAIRE MARIAM'}
            autoComplete="off"
          />
        </label>
        <p className="mt-1 text-xs text-ink-2">
          {texteGateau.trim() !== '' && supplementCouvert(lignes, SUPPLEMENT_ECRITURE, catalogue, famillesGateau)
            ? 'Supplément écriture au bon. '
            : ''}
          Relisez le texte au client, s’il vous plaît&nbsp;: imprimé tel quel, sous ce gâteau.
        </p>
        <Case compact coche={sansEcriture} onChange={(v) => surLeGateau(ligne.cle, { sansEcriture: v })}>
          Pas d’écriture
        </Case>
        <Case
          compact
          coche={photoImprimee}
          desactive={!photoAuTarif && !photoImprimee}
          aide={
            photoImprimee && supplementCouvert(lignes, SUPPLEMENT_PHOTO, catalogue, famillesGateau)
              ? 'Supplément photo au bon'
              : !photoAuTarif
                ? 'Supplément «\u00a0Photo\u00a0» absent du tarif\u00a0: prévenez le manager, s’il vous plaît'
                : undefined
          }
          onChange={(v) => surLeGateau(ligne.cle, { photoImprimee: v })}
        >
          Photo à imprimer sur ce gâteau
        </Case>
        {i === iPateASucre ? (
          <Case
            compact
            coche={aSupplement(lignes, SUPPLEMENT_PATE_A_SUCRE)}
            desactive={!ficheSucre && !aSupplement(lignes, SUPPLEMENT_PATE_A_SUCRE)}
            aide={
              aSupplement(lignes, SUPPLEMENT_PATE_A_SUCRE)
                ? 'Au bon, autant de parts que le gâteau'
                : !ficheSucre
                  ? 'Pâte à sucre absente du tarif\u00a0: prévenez le manager, s’il vous plaît'
                  : undefined
            }
            onChange={(v) =>
              setLignes((ls) =>
                basculerSupplementParPersonne(ls, SUPPLEMENT_PATE_A_SUCRE, v, catalogue, famillesGateau, SUPPLEMENTS_PAR_PERSONNE, CORRESPONDANCES_COMPTOIR),
              )
            }
          >
            {ficheSucre ? `${libelleProduit(ficheSucre)} (${formaterEuros(ficheSucre.prix.prixCentimes)}/pers.)` : 'Pâte à sucre'}
          </Case>
        ) : null}
        {rendre(signaux, 'pièces', `gateau-${ligne.cle}`)}
      </div>
    );
  };

  /* ----------------------------------------------- Le bon (lignes saisies) */
  const bon =
    cal && catalogue ? (
      <div ref={zoneBon}>
        <h2 className="mb-2 text-base font-semibold text-ink">
          Le bon {lignes.length > 0 ? `(${lignes.length} ligne${lignes.length > 1 ? 's' : ''})` : ''}
        </h2>
        {lignes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-fort p-3 text-sm text-ink-2">
            Touchez un produit pour l’ajouter. Chaque toucher ajoute 1.
          </p>
        ) : (
          <ul className="grid gap-2">
            {lignes.map((ligne, i) => {
              const fiche = ficheDe(catalogue, ligne.produitId);
              const r = resultatsLignes[i];
              const unite = uniteDe(fiche, ligne);
              // Refus qui portent sur PLUSIEURS lignes (suppléments…) : `controlerLigne`
              // ne les voit pas, `blocagesCommande` si. Affichés sur la ligne dès sa
              // saisie, sans doubler le refus propre à la ligne.
              const blocagesLigne = r
                ? blocages.filter((b) => indexLigne(b.champ) === i && !CHAMPS_SUR_LE_GATEAU.has(champLocal(b.champ)) && (r.ok || b.code !== r.code))
                : [];
              // Écriture et photo de CE gâteau : dans son bloc « Sur le gâteau » (lot 2).
              const gateau = estLigneGateau(ligne, catalogue, famillesGateau);
              const signauxSurGateau = gateau
                ? tous.filter((s) => indexLigne(s.champ) === i && CHAMPS_SUR_LE_GATEAU.has(champLocal(s.champ)))
                : [];
              // Ancien tarif : l'accord manquant n'est pas répété sur chaque ligne (refus unique plus haut).
              const accordAncien = ancienTarif && r && !r.ok && r.code === 'ERR_DROIT_INSUFFISANT' && sansAccord(i);
              const signaux: SignalementAffichable[] = [
                ...(r && !accordAncien ? (r.ok ? r.signalements : [r]) : []),
                ...blocagesLigne,
                ...tous.filter((s) => indexLigne(s.champ) === i && s.code === 'AVERT_PRODUIT_EN_DOUBLE'),
              ];
              const eclaire = eclair?.cle === ligne.cle;
              return (
                <li
                  key={ligne.cle}
                  id={`bon-${ligne.cle}`}
                  style={{ scrollMarginTop: 8 }}
                  className={`rounded-xl border-2 p-2.5 transition-colors duration-500 ${
                    eclaire ? 'border-accent bg-accent-doux' : 'border-line bg-surface'
                  }`}
                >
                  <LigneDuBon
                    ligne={ligne}
                    fiche={fiche}
                    ficheGateau={ficheDe(catalogue, gateauDeLaLigne(ligne))}
                    tailleCourante={tailleChoisie(ligne, CORRESPONDANCES_COMPTOIR)}
                    prixTaille={(t) =>
                      ficheComptoirPourTaille(gateauDeLaLigne(ligne), t, catalogue, CORRESPONDANCES_COMPTOIR, ligne.gouts)?.prix.prixCentimes ?? null
                    }
                    onTaille={(t) =>
                      setLignes((ls) => ls.map((l, j) => (j === i ? choisirTaille(l, t, catalogue, CORRESPONDANCES_COMPTOIR) : l)))
                    }
                    resultat={r}
                    unite={unite}
                    actif={actif}
                    setActif={setActif}
                    detail={ligneDetail === ligne.cle}
                    basculerDetail={() => setLigneDetail(ligneDetail === ligne.cle ? null : ligne.cle)}
                    options={options}
                    tailles={cal.reglement.taillesGateau}
                    unGateau={fiche !== null && estFicheGateauDuComptoir(fiche, famillesGateau)}
                    onChange={(p) => majLigne(i, p)}
                    // Taille ET goût donnés : l'écriture est l'étape suivante (jamais avant la taille).
                    onGoutChoisi={gateau && ligne.quantite !== null ? () => montrerEcriture(ligne.cle) : undefined}
                    onRetirer={() => retirerLigne(i)}
                    // Supplément Écriture / Photo dû pour un gâteau : pas de × (non retirable à la main, 28/10/2026).
                    retirable={!supplementImpose(ligne, lignes, catalogue, famillesGateau)}
                    onGerantLibre={() =>
                      avecGerant(`Prix d’une demande hors catalogue\u00a0: «\u00a0${ligne.libelleLibre || 'ligne libre'}\u00a0».`, (d) =>
                        majLigne(i, { deverrouillage: d }),
                      )
                    }
                    onAutreForme={() => setZoneDessin(true)}
                    onRetirerPhoto={() => setLignes((ls) => retirerPhoto(ls, ligne.cle))}
                  />
                  {rendre(signaux, unite, `ligne-${ligne.cle}`)}
                  {gateau ? blocGateauDe(ligne, i, signauxSurGateau) : null}
                </li>
              );
            })}
          </ul>
        )}
        {(() => {
          // Détail des montants : lignes chiffrées seulement ; une ligne pas encore chiffrable est dite.
          const chiffres = (enCours?.montants ?? []).filter((m): m is number => m !== null);
          const incomplet = enCours !== null && !enCours.complet;
          return chiffres.length > 1 || (incomplet && chiffres.length > 0) ? (
            <p className="chiffres mt-2 text-sm font-medium text-ink">
              {chiffres.map((m) => formaterEuros(m)).join(' + ')} = {formaterEuros(totalTarif)}
              {incomplet ? <span className="font-normal text-ink-2"> + à compléter</span> : null}
            </p>
          ) : null;
        })()}
      </div>
    ) : null;

  /* ------------------------------------- Montants : convenu, acompte, reste */
  const paiement =
    cal && catalogue ? (
      <div className="grid gap-3">
        <div>
          {remise ? (
            <ChampPave
              libelle={`Prix convenu (accord de ${remise.par})`}
              valeur={totalConvenu === null ? null : formaterEuros(totalConvenu)}
              ouvert={actif === 'total'}
              onBasculer={() => setActif(actif === 'total' ? null : 'total')}
            />
          ) : (
            <button
              type="button"
              className="min-h-12 text-left text-sm text-ink-2 underline underline-offset-2"
              onClick={() => avecGerant('Prix convenu sous le tarif (réduction).', (d) => { setRemise(d); setActif('total'); })}
            >
              Prix convenu avec le client (accord du manager)
            </button>
          )}
        </div>
        <div>
          <ChampPave
            libelle="Acompte"
            valeur={acompte === null ? null : formaterEuros(acompte)}
            ouvert={actif === 'acompte'}
            onBasculer={() => setActif(actif === 'acompte' ? null : 'acompte')}
            enErreur={signauxMontants.some((s) => s.niveau === 'bloquant' && champLocal(s.champ) === 'acompte')}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Choix actif={modePaiement === 'especes'} onClick={() => setModePaiement('especes')}>Espèces</Choix>
            <Choix actif={modePaiement === 'virement'} onClick={() => setModePaiement('virement')}>Virement</Choix>
          </div>
        </div>
        {rendre(signauxMontants)}
      </div>
    ) : null;

  const libelleValider = envoi ? 'Enregistrement…' : modification ? 'Enregistrer les changements' : 'Valider la commande';

  /** Téléphone : montants, reste et validation en fin de page. */
  const montants =
    cal && catalogue ? (
      <div className="grid gap-3">
        {paiement}
        <div className="flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-base text-ink-2">Reste à payer au retrait</span>
          <span className="chiffres text-xl font-semibold text-ink">{texteReste.replace(/^reste /, '')}</span>
        </div>
        {refusServeur ? rendre([refusServeur]) : null}
        <Bouton variante="principal" className="min-h-14 w-full text-lg" disabled={envoi} onClick={() => void valider()}>
          {libelleValider}
        </Bouton>
      </div>
    ) : null;

  const totalAnnonce = (
    <div className="flex items-baseline justify-between gap-2" aria-live="polite">
      <span className="text-sm text-ink-2">Total à annoncer</span>
      <span
        className={`chiffres rounded-lg px-1.5 text-4xl font-bold leading-tight transition-colors duration-500 ${
          eclair ? 'bg-accent-doux text-accent' : 'text-ink'
        }`}
      >
        {texteTotal.montant ?? <span className="text-xl font-semibold text-ink-2">{texteTotal.suite}</span>}
        {texteTotal.montant && texteTotal.suite ? <span className="ml-1 text-sm font-medium text-ink-2">{texteTotal.suite}</span> : null}
      </span>
    </div>
  );

  /* ------------------- Remarques, demande inhabituelle, zone pour dessiner */
  // Valent pour toute la commande (salé compris) : en bas du bon, discrètes.
  const precisions = (
    <>
      <label className="block">
        <span className="mb-1 block text-sm text-ink-2">Remarques</span>
        <textarea className={`${CHAMP_TEXTE} min-h-16 py-2`} value={remarques} onChange={(e) => setRemarques(e.target.value)} />
      </label>
      <Case compact coche={demandeInhabituelle} onChange={setDemandeInhabituelle}>
        <span className="text-sm text-ink-2">Demande inhabituelle (ingrédient particulier, moule spécial…)</span>
      </Case>
      {rendre(signauxInhabituelle)}
      <Case compact coche={zoneDessin} onChange={setZoneDessin}>
        <span className="text-sm text-ink-2">Zone pour dessiner sur le bon (dessin, croquis du client)</span>
      </Case>
      {/* Photo d'exemple du client : une par COMMANDE (lot 2, 28/10/2026), salé compris. */}
      <Case compact coche={photoWhatsapp} onChange={setPhotoWhatsapp}>
        <span className="text-sm text-ink-2">Photo d’exemple envoyée sur WhatsApp</span>
      </Case>
    </>
  );

  /* ------------------------------------------------ Jour et heure de retrait */
  // R54 (18/10/2026) : heures d'ouverture du magasin le jour choisi (réglages
  // du gérant : jour par jour + dates exceptionnelles), calculées par le
  // domaine, pour tous les produits. Le domaine juge de toute façon.
  let ouverture: { ouverture: string; fermeture: string } | null = null;
  if (cal && dateRetrait) {
    try {
      ouverture = horairesOuvertureDuJour(dateRetrait, cal.reglement.horairesOuverture);
    } catch {
      ouverture = null; // réglage illisible : le domaine refusera, avec son message
    }
  }
  const signauxRetrait = [...signauxDate, ...signauxHeure].filter((s) => !estVideDuHaut(s));
  const bande = cal ? (
    <div ref={bandeRetrait} className="min-w-0">
      <BandeRetrait
        aujourdhui={cal.aujourdhui}
        date={dateRetrait}
        heure={heureRetrait}
        etatJour={(iso) => {
          const f = fermetureDuJour(iso, cal.joursFermes);
          return f ? { ferme: true, libelle: f.nature === 'hebdomadaire' ? undefined : f.libelle } : { ferme: false };
        }}
        premiereDate={premiereDate}
        horaires={ouverture}
        onDate={setDateRetrait}
        onHeure={setHeureRetrait}
        enErreur={signauxRetrait.some((s) => s.niveau === 'bloquant')}
        messageJour={sousLeChamp(videJour)}
        messageHeure={sousLeChamp(videHeure)}
        signalements={
          signauxRetrait.length > 0 ? (
            <div className={etroit ? '' : 'max-h-40 overflow-y-auto overscroll-contain'}>{rendre(signauxRetrait)}</div>
          ) : null
        }
      />
    </div>
  ) : null;

  const grille = (tablette: boolean, enTete?: ReactNode) =>
    catalogue ? (
      <GrilleProduits
        tablette={tablette}
        zone={tablette ? zoneProduits : undefined}
        enTete={enTete}
        catalogue={catalogue}
        lignes={lignes}
        recherche={recherche}
        onRecherche={setRecherche}
        rayon={rayon}
        onRayon={setRayon}
        rayonsOuverts={rayonsOuverts}
        onRayonsOuverts={setRayonsOuverts}
        eclair={eclair}
        sansGateau={sansGateau}
        onToucher={(f) => toucher(f)}
        onAutreDemande={ajouterLigneLibre}
        onPhotos={() => setGalerieOuverte(true)}
      />
    ) : null;

  // Photo en attente (bûche, tarte…) : rappel visible tant qu'aucun produit n'est touché.
  const bandeauPhoto = photoEnAttente ? (
    <div
      role="status"
      data-champ="photoEnAttente"
      className={`mb-2 flex items-center gap-3 rounded-xl border-2 bg-accent-doux p-2 ${tentative ? 'border-alerte' : 'border-accent'}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoEnAttente.url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
      <p className="min-w-0 flex-1 text-base leading-tight text-ink">
        <b>{navigationPourPhoto(photoEnAttente).consigne}</b>
        <span className="block text-sm text-ink-2">La photo {photoEnAttente.id} ira sur le produit que vous touchez.</span>
      </p>
      <button
        type="button"
        onClick={() => setPhotoEnAttente(null)}
        className="min-h-12 shrink-0 rounded-xl border-2 border-line-fort bg-surface px-3 text-sm font-medium text-ink"
      >
        Retirer la photo
      </button>
    </div>
  ) : null;

  const galerie = galerieOuverte ? <GaleriePhotos onChoisir={choisirPhoto} onFermer={fermerGalerie} /> : null;
  const fenetreAbandon = abandonOuvert ? (
    <FenetreAbandon
      modification={modification}
      onContinuer={() => setAbandonOuvert(false)}
      onAbandonner={() => router.push('/commandes')}
    />
  ) : null;

  const accesGerant = demande ? (
    <AccesGerant
      raison={demande.raison}
      onAccorde={(par) => {
        setParGerant(par);
        demande.appliquer({ par, le: new Date().toISOString() });
        setDemande(null);
      }}
      onAnnuler={() => setDemande(null)}
    />
  ) : null;

  const titre = modification ? `Modifier la commande ${commande.numero}` : 'Nouvelle commande';

  const enTeteChargement = (
    <>
      {refusChargement ? <div className="mb-4">{rendre([refusChargement])}</div> : null}
      {chargement ? (
        <div className="grid gap-3">
          <Chargement libelle="Chargement du tarif et du calendrier…" />
          <RappelChargement />
        </div>
      ) : null}
    </>
  );

  /* ======================================================== Rendu tablette */
  // Tout tient dans l'écran (1180×820 paysage comme 820×1180 portrait) :
  //   bande client (nom · téléphone · retrait · comptoir/téléphone) — 1 ligne en paysage
  //   ├─ produits : recherche + familles fixes, grille qui défile en interne
  //   │  (le panneau « retrait » et l'accord du gérant se superposent à la grille)
  //   └─ colonne du pavé : pavé compact (si un champ est actif), bon qui défile,
  //      total et « Valider » toujours visibles en bas.
  // Calcul à 820 px de haut (barre ≈ 61 px) : cadre = 820 − 77 − 12 = 731 px ;
  // bande 48 + 8 → zone de travail ≈ 675 px ; colonne : pavé compact ≈ 390,
  // pied (total + Valider) ≈ 130 → le bon garde ≈ 150 px et défile.
  // Fenêtre « Il manque : » — commune aux mises en page tablette et téléphone.
  const recap =
    recapOuvert && manques.length > 0 ? (
        <RecapManques
          manques={manques}
          libelle={(m) => libelleManque(m, lignes, catalogue)}
          onAller={(m) => {
            setRecapOuvert(false);
            const i = indexLigne(m.champ);
            window.setTimeout(() => {
              const cible =
                document.querySelector(`[data-champ="${CSS.escape(m.champ ?? '')}"]`) ??
                (i !== null && lignes[i] ? document.getElementById(`bon-${lignes[i].cle}`) : null);
              cible?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 60);
          }}
          onFermer={() => setRecapOuvert(false)}
        />
      ) : null;

  if (!etroit) {
    const gauche = cotePave === 'gauche';
    const styleCadre: CSSProperties = {
      // Pleine largeur de la tablette (la page est limitée à max-w-5xl), plafonnée à 90rem.
      marginInline: 'max(calc(50% - 50vw + 1rem), calc(50% - 45rem))',
      ...(hautCadre === null ? {} : { height: `calc(100dvh - ${Math.ceil(hautCadre) + MARGE_BAS_CADRE_PX}px)` }),
    };
    return (
      <>
        <p className="sr-only" aria-live="polite">{annonce}</p>
        {cal && catalogue ? null : (
          <>
            <Entete titre={titre} actions={<Bouton onClick={annuler}>Annuler</Bouton>} />
            {enTeteChargement}
          </>
        )}
        {cal && catalogue ? (
          <div ref={cadre} style={styleCadre} className="-mb-8 -mt-4 flex min-h-[28rem] flex-col gap-2">
            {/* -------------------------------------------- Bande client */}
            <div className="flex flex-none flex-wrap items-center gap-2">
              <div className="min-w-0 max-w-[12rem] shrink-0">
                <h1 className="truncate text-lg font-semibold leading-tight tracking-tight text-ink" title={titre}>
                  {modification ? `Commande ${commande.numero}` : 'Nouvelle commande'}
                </h1>
                <p className="truncate text-xs text-ink-2">
                  {modification ? 'Changements enregistrés et datés' : <>Prise par <span className="font-medium text-ink">{vendeur}</span></>}
                </p>
              </div>
              <div className="flex min-w-[8rem] flex-[1_1_10rem] flex-col">
                <input
                  ref={champClient}
                  className={`min-h-12 w-full rounded-xl border-2 bg-surface px-3 text-base text-ink placeholder:text-ink-3 ${
                    videNom ? 'border-alerte' : 'border-line-fort'
                  }`}
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Nom du client"
                  aria-label="Nom du client"
                  aria-invalid={videNom ? true : undefined}
                  autoComplete="off"
                />
                {sousLeChamp(videNom)}
              </div>
              <div className="flex min-w-0 flex-[1_1_10rem] flex-col">
                <BoutonBande
                  libelle="Tél."
                  valeur={telephone || null}
                  vide="Toucher"
                  actif={actif === 'telephone'}
                  enErreur={videTelephone !== null || refusClient.some((s) => s.niveau === 'bloquant' && champLocal(s.champ) === 'telephone')}
                  onClick={() => setActif(actif === 'telephone' ? null : 'telephone')}
                  className="w-full"
                  ariaLabel={`Téléphone du client${telephone ? ` : ${telephone}` : ''}`}
                />
                {sousLeChamp(videTelephone)}
              </div>
              <div role="group" aria-label="Commande prise" className="flex shrink-0 gap-0.5 rounded-xl border-2 border-line-fort bg-surface p-0.5">
                <Segment actif={origine === 'comptoir'} onClick={() => { setOrigine('comptoir'); setModePaiement('especes'); }}>
                  Comptoir
                </Segment>
                <Segment actif={origine === 'telephone'} onClick={() => { setOrigine('telephone'); setModePaiement('virement'); }}>
                  Téléphone
                </Segment>
              </div>
              <Bouton className="shrink-0" onClick={annuler}>Annuler</Bouton>
            </div>

            {/* Signalements qui ne tiennent pas dans la bande (rares : ils prennent sur la grille, jamais sur la page). */}
            {refusChargement || signauxStatut.length > 0 || refusClient.length > 0 ? (
              <div className="max-h-[40%] flex-none overflow-y-auto overscroll-contain">
                {refusChargement ? rendre([refusChargement]) : null}
                {rendre(signauxStatut)}
                {rendre(refusClient)}
              </div>
            ) : null}

            {/* ------------------------------------------ Zone de travail */}
            <div className={`flex min-h-0 flex-1 gap-3 ${gauche ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Produits */}
              <section aria-label="Produits" className="relative flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-line bg-surface">
                {/* Jour et heure de retrait : bande compacte, toujours visible, jamais par-dessus les produits. */}
                <div className="flex-none px-3 pt-3">{bande}</div>
                {grille(
                  true,
                  bandeauPhoto || signauxProduits.length > 0 ? (
                    <>
                      {bandeauPhoto}
                      {signauxProduits.length > 0 ? rendre(signauxProduits) : null}
                    </>
                  ) : null,
                )}

                {accesGerant ? (
                  <div className="absolute inset-0 z-20 overflow-y-auto overscroll-contain rounded-2xl border-2 border-accent bg-surface p-4 shadow-lg">
                    {accesGerant}
                  </div>
                ) : null}
              </section>

              {/* Colonne du pavé : pavé, bon (défile), total + Valider (toujours visibles) */}
              <aside
                aria-label="Le bon et le pavé de saisie"
                className="flex min-h-0 w-72 shrink-0 flex-col overflow-hidden rounded-2xl border-2 border-line-fort bg-surface lg:w-80"
              >
                {blocPave ? (
                  <div className="flex-none border-b border-line p-3 pb-1">
                    <ContexteTaillePave.Provider value="compact">{blocPave}</ContexteTaillePave.Provider>
                  </div>
                ) : null}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
                  {bon}
                  <section aria-label="Remarques" className="mt-3 border-t border-line pt-2">{precisions}</section>
                  <section className="mt-4 border-t border-line pt-3">
                    <h2 className={TITRE}>Paiement</h2>
                    {paiement}
                  </section>
                  <div className="mt-4 border-t border-line pt-3">
                    <BasculeCotePave />
                  </div>
                </div>
                <div className="flex-none border-t border-line bg-surface p-3">
                  <div className="flex items-end justify-between gap-2" aria-live="polite">
                    <div className="min-w-0 text-sm leading-tight text-ink-2">
                      <div>Total à annoncer</div>
                      <div className="chiffres truncate">
                        {lignes.length === 0 ? 'aucun produit' : texteReste}
                      </div>
                    </div>
                    <span
                      className={`chiffres shrink-0 rounded-lg px-1.5 text-3xl font-bold leading-tight transition-colors duration-500 ${
                        eclair ? 'bg-accent-doux text-accent' : 'text-ink'
                      }`}
                    >
                      {texteTotal.montant ?? <span className="text-xl font-semibold text-ink-2">{texteTotal.suite}</span>}
                      {texteTotal.montant && texteTotal.suite ? (
                        <span className="ml-1 block text-right text-xs font-medium text-ink-2">{texteTotal.suite}</span>
                      ) : null}
                    </span>
                  </div>
                  {refusServeur ? <div className="max-h-48 overflow-y-auto">{rendre([refusServeur])}</div> : null}
                  <Bouton variante="principal" className="mt-2 min-h-14 w-full text-lg" disabled={envoi} onClick={() => void valider()}>
                    {libelleValider}
                  </Bouton>
                </div>
              </aside>
            </div>
          </div>
        ) : null}
      {recap}
      {galerie}
      {fenetreAbandon}
      </>
    );
  }

  /* ======================================================= Rendu téléphone */
  return (
    <>
      <Entete
        titre={titre}
        sousTitre={
          modification ? (
            <>Chaque changement est enregistré et daté. Prix au tarif du jour de la prise de commande.</>
          ) : (
            <>Prise par <span className="font-medium text-ink">{vendeur}</span></>
          )
        }
        actions={<Bouton onClick={annuler}>Annuler</Bouton>}
      />
      <p className="sr-only" aria-live="polite">{annonce}</p>

      {enTeteChargement}

      {accesGerant ? <div className="mb-4">{accesGerant}</div> : null}

      {cal && catalogue ? (
        <DispositionAvecPave pave={blocPave}>
          <div className={`grid grid-cols-[minmax(0,1fr)] gap-4 ${!blocPave ? 'pb-24' : ''}`}>
            {signauxStatut.length > 0 ? rendre(signauxStatut) : null}

            {/* ---------------------------------------------------- Client */}
            <Carte className="p-4">
              <h2 className={TITRE}>Client</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm text-ink-2">Nom</span>
                  <input
                    ref={champClient}
                    className={videNom ? CHAMP_TEXTE.replace('border-line-fort', 'border-alerte') : CHAMP_TEXTE}
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    aria-invalid={videNom ? true : undefined}
                    autoComplete="off"
                  />
                  {sousLeChamp(videNom)}
                </label>
                <div className="self-end">
                  <ChampPave
                    libelle="Téléphone"
                    valeur={telephone || null}
                    ouvert={actif === 'telephone'}
                    onBasculer={() => setActif(actif === 'telephone' ? null : 'telephone')}
                    enErreur={videTelephone !== null}
                  />
                  {sousLeChamp(videTelephone)}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Choix actif={origine === 'comptoir'} onClick={() => { setOrigine('comptoir'); setModePaiement('especes'); }}>
                  Au comptoir
                </Choix>
                <Choix actif={origine === 'telephone'} onClick={() => { setOrigine('telephone'); setModePaiement('virement'); }}>
                  Par téléphone
                </Choix>
              </div>
              {rendre(refusClient)}
            </Carte>

            {/* ----------------------------------- Date et heure de retrait */}
            <Carte className="p-3">{bande}</Carte>

            {/* -------------------------------------------------- Produits */}
            <div ref={zoneProduits}>
              <Carte className="p-4">
                {grille(false, bandeauPhoto)}
                {rendre(signauxProduits)}
              </Carte>
            </div>

            <Carte className="p-4">
              {totalAnnonce}
              <div className="mt-3">{bon}</div>
            </Carte>

            <Carte className="p-4">{precisions}</Carte>

            <Carte className="p-4">{montants}</Carte>
          </div>
        </DispositionAvecPave>
      ) : null}

      {recap}
      {galerie}
      {fenetreAbandon}

      {/* Téléphone, pavé fermé : total et validation toujours à portée de pouce. */}
      {cal && catalogue && !blocPave ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-2.5 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="chiffres text-2xl font-bold leading-tight text-ink">
                {texteTotal.montant ?? <span className="text-lg font-semibold text-ink-2">{texteTotal.suite}</span>}
                {texteTotal.montant && texteTotal.suite ? <span className="ml-1 text-sm font-medium text-ink-2">{texteTotal.suite}</span> : null}
              </div>
              <div className="truncate text-sm text-ink-2">
                {lignes.length === 0 ? 'Aucun produit' : texteReste}
                {(blocages.length > 0 || resultatsLignes.some((r) => r && !r.ok)) && tentative ? (
                  <span className="font-semibold text-bloquant"> · à corriger (en rouge)</span>
                ) : null}
              </div>
            </div>
            <Bouton variante="principal" className="shrink-0" disabled={envoi} onClick={() => void valider()}>
              {envoi ? 'Envoi…' : 'Valider'}
            </Bouton>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ================================================== Lignes d'une commande */

/** Accord de taille enregistré sur une ligne (colonnes `tailleAutoriseePar` / `tailleAutoriseeLe`). */
function accordTaille(l: Commande['lignes'][number]): Deverrouillage | null {
  const t = l as typeof l & { tailleAutoriseePar?: string | null; tailleAutoriseeLe?: string | null };
  return t.tailleAutoriseePar && t.tailleAutoriseeLe ? { par: t.tailleAutoriseePar, le: t.tailleAutoriseeLe } : null;
}

/** Forme enregistrée sur une ligne (colonne `forme`, R63), null si absente ou illisible. */
function formeEnregistree(l: Commande['lignes'][number]): Forme | null {
  return estForme(l.forme) ? l.forme : null;
}

/** Commande enregistrée → lignes de l'écran (prix appliqués et accords conservés). */
function lignesDepuisCommande(c: Commande): LigneEcran[] {
  // Lot 2 : écriture et photo par gâteau ; commande ancienne → sur son premier gâteau.
  const sur = surLesGateaux(c);
  const ecritures = sur.some((s) => s.texteGateau !== null);
  const photos = sur.some((s) => s.photoImprimee);
  return c.lignes.map((l, i) => {
    const produitId = l.produitCatalogue?.cleCatalogue ?? null;
    const accordPar = produitId ? l.sousPlancherAutorisePar : l.ligneLibreAutoriseePar;
    const accordLe = produitId ? l.sousPlancherAutoriseLe : l.ligneLibreAutoriseeLe;
    return {
      cle: nouvelleCle(),
      produitId,
      // Ligne libre, ou ligne antérieure au lot 2 (sans produit du catalogue).
      libelleLibre: produitId ? '' : l.libelle,
      quantite: l.quantite,
      // Prix saisi (régime C ou ligne libre) : relu tel quel ; A / B : toujours le catalogue.
      prixUnitaireCentimes: l.prixCentimes,
      nbSymboles: l.nbSymboles ?? null,
      formes: l.formes ?? '',
      // « Autre dessin » (cœur…) : relu d'après le texte (non enregistré à part, voir rapport).
      formesLibres: formesLibresEnregistrees(l.formes),
      // Ligne libre : un gâteau libre porte toujours un goût (exigé) ; sans goût,
      // la question est reposée (jamais deviné « non », LOI 6 / règle de doute).
      gateauLibre: produitId ? null : (l.gouts ?? []).some((g) => g.trim() !== '') ? true : null,
      gouts: l.gouts ?? [],
      decorations: l.decorations ?? [],
      nbObjets: l.nbObjets ?? null,
      precision: l.precision ?? '',
      deverrouillage: accordPar && accordLe ? { par: accordPar, le: accordLe } : null,
      // Taille hors standard déjà accordée (LOI 11) : renvoyée telle quelle, le
      // serveur ne la conserve que pour ce produit à cette quantité exacte.
      deverrouillageTaille: accordTaille(l),
      // R63 : forme enregistrée (colonne `forme`), relue telle quelle ; autre valeur → à rechoisir.
      forme: formeEnregistree(l),
      // Galerie (26/10/2026) : photo de modèle enregistrée, relue telle quelle.
      photoModele: l.photoModele ?? null,
      // R60 : gâteau du comptoir (1 pièce) qui remplace un gâteau sur commande →
      // les boutons de taille du gâteau d'origine restent affichés à la
      // modification. Plusieurs pièces (achat comptoir) : quantité au pavé, inchangée.
      origineSurCommande:
        l.quantite === 1 ? (gateauSurCommandeDe(produitId, CORRESPONDANCES_COMPTOIR)?.surCommande ?? null) : null,
      texteGateau: sur[i]?.texteGateau ?? '',
      sansEcriture: sur[i]?.sansEcriture === true,
      photoImprimee: sur[i]?.photoImprimee === true,
      // Supplément Écriture / Photo d'un gâteau qui en porte : automatique (il suit les gâteaux).
      supplementAuto: (produitId === SUPPLEMENT_ECRITURE && ecritures) || (produitId === SUPPLEMENT_PHOTO && photos),
    };
  });
}

/** Le pavé d'un champ chiffré d'une ligne (symboles, quantité/poids, prix, objets). */
function PaveDeLigne({
  ligne,
  fiche,
  champ,
  onChange,
  ouvrir,
}: {
  ligne: LigneEcran;
  fiche: FicheTarifee | null;
  champ: string;
  onChange: (p: Partial<LigneEcran>) => void;
  /** Champ suivant à ouvrir, ou null pour fermer le pavé. */
  ouvrir: (champ: string | null) => void;
}) {
  const libre = ligne.produitId === null;
  const unite = uniteDe(fiche, ligne);
  const plancher = fiche?.produit.regimePrix === 'C' && fiche.prix.prixEstPlancher === true;
  const nom = fiche ? libelleLigneEcran(ligne, fiche, LIBELLES_SELON_GOUT) : ligne.libelleLibre || 'Autre demande';

  if (champ === 'symboles') {
    return (
      <PaveEntier
        libelle={`${nom} — nombre de chiffres ou lettres`}
        contexte="commande"
        libelleUnite="chiffres ou lettres"
        quantite={ligne.nbSymboles}
        // Un texte qui compte autre chose est vidé (jamais « 25 » avec 1, 28/10/2026).
        onChange={(n) => onChange(n === null ? { nbSymboles: null } : choisirNombreSymboles(ligne, n))}
        onValider={() => ouvrir('taille')}
        champ="nbSymboles"
      />
    );
  }
  if (champ === 'quantite') {
    return fiche?.produit.unite === 'kg' ? (
      <PaveDecimalPoids
        libelle={nom}
        contexte="commande"
        grammes={ligne.quantite}
        onChange={(g) => onChange({ quantite: g })}
        onValider={() => ouvrir(null)}
      />
    ) : (
      <PaveEntier
        libelle={nom}
        contexte="commande"
        libelleUnite={unite}
        quantite={ligne.quantite}
        onChange={(q) => onChange({ quantite: q })}
        // Le prix d'un produit du tarif est automatique (plancher pré-rempli, modifiable en
        // touchant le champ) : on n'y saute pas (22/10/2026). Seule une demande libre, sans
        // prix au tarif, enchaîne sur le prix.
        onValider={() => ouvrir(libre ? 'prix' : fiche?.prix.maxParUnite ? 'objets' : null)}
      />
    );
  }
  if (champ === 'prix' && (plancher || libre)) {
    return (
      <PaveMontant
        libelle={libre ? `${nom} — ${ligne.gateauLibre ? 'prix par part, ' : ''}fixé avec le manager` : `${nom} — prix par personne`}
        sousTitre={plancher && fiche ? `à partir de ${formaterEuros(fiche.prix.prixCentimes)}, modifiable vers le haut` : undefined}
        centimes={ligne.prixUnitaireCentimes ?? (plancher && fiche ? fiche.prix.prixCentimes : null)}
        onChange={(c) => onChange({ prixUnitaireCentimes: c, deverrouillage: libre ? ligne.deverrouillage : null })}
        onValider={() => ouvrir(null)}
        champ="prixCentimes"
      />
    );
  }
  if (champ === 'objets' && fiche?.prix.maxParUnite) {
    return (
      <PaveEntier
        libelle={`${nom} — nombre total demandé`}
        contexte="commande"
        libelleUnite={fiche.prix.maxParUnite.objet || 'sandwichs'}
        quantite={ligne.nbObjets}
        onChange={(n) => onChange({ nbObjets: n })}
        onValider={() => ouvrir(null)}
        champ="nbObjets"
      />
    );
  }
  return null;
}

// Mots-clés et libellés de la fenêtre « Il manque » : src/components/commande/manques.ts (testé).

/**
 * Fenêtre « Il manque : » au centre de l'écran (propriétaire, 22/10/2026) :
 * simple, une liste de mots-clés, fermée d'un geste (OK, ✕ ou à côté). Un
 * refus de règle y porte sa phrase courte du domaine ; aucun bouton (28/10/2026).
 * Toucher un élément mène au champ concerné, sans que ce soit nécessaire.
 */
function RecapManques({
  manques,
  libelle,
  onAller,
  onFermer,
}: {
  manques: readonly SignalementAffichable[];
  libelle: (m: SignalementAffichable) => { titre: string; detail: string | null };
  onAller: (m: SignalementAffichable) => void;
  onFermer: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6" onClick={onFermer}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="recap-manques-titre"
        className="relative w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer"
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-2xl text-ink-3 hover:text-ink"
        >
          ✕
        </button>
        <h2 id="recap-manques-titre" className="mb-3 text-lg font-bold text-bloquant">
          Il manque&nbsp;:
        </h2>
        <ul className="grid gap-1">
          {manques.map((m) => (
            <li key={`${m.code}|${m.champ ?? ''}`}>
              <button
                type="button"
                onClick={() => onAller(m)}
                className="w-full rounded-lg px-1 py-1.5 text-left text-base font-semibold text-ink hover:bg-surface-2"
              >
                • {libelle(m).titre}
                {/* Refus de règle (mardi, minimum…) : sa phrase du domaine, sans bouton (28/10/2026). */}
                {libelle(m).detail ? (
                  <span className="mt-0.5 block pl-3 text-sm font-normal text-ink-2">{libelle(m).detail}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onFermer}
          className="mt-4 min-h-12 w-full rounded-xl bg-accent text-base font-semibold text-white active:bg-accent-fort"
        >
          Compléter
        </button>
      </div>
    </div>
  );
}

/**
 * « Annuler » avec une saisie en cours (audit du 28/10/2026) : petite fenêtre
 * sobre. « Continuer la commande » est le choix par défaut (focus, touche
 * Échap, toucher à côté) : rien n'est perdu sans un second geste voulu.
 */
function FenetreAbandon({
  modification,
  onContinuer,
  onAbandonner,
}: {
  modification: boolean;
  onContinuer: () => void;
  onAbandonner: () => void;
}) {
  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onContinuer();
    };
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [onContinuer]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6" onClick={onContinuer}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="abandon-titre"
        aria-describedby="abandon-texte"
        className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="abandon-titre" className="text-lg font-bold text-ink">
          {modification ? 'Abandonner les changements\u00a0?' : 'Abandonner cette commande\u00a0?'}
        </h2>
        <p id="abandon-texte" className="mt-1 text-base text-ink-2">
          {modification ? 'Les changements faits ici seront perdus.' : 'Ce qui a été saisi sera perdu.'}
        </p>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            autoFocus
            onClick={onContinuer}
            className="min-h-12 w-full rounded-xl bg-accent text-base font-semibold text-white active:bg-accent-fort"
          >
            Continuer la commande
          </button>
          <button
            type="button"
            onClick={onAbandonner}
            className="min-h-12 w-full rounded-xl border-2 border-line-fort bg-surface text-base font-medium text-bloquant"
          >
            Abandonner
          </button>
        </div>
      </div>
    </div>
  );
}

/** Goûts toujours visibles en gros boutons ; les suivants derrière « Autres goûts ». */
const GOUTS_VISIBLES = 8;

/**
 * R62 (propriétaire, 22/10/2026) : le goût du gâteau, bien en vue sous la
 * taille. Un goût (ou une recette d'entremet), un par étage pour une pièce
 * montée ; « Au choix du pâtissier » quand le client hésite. Décorations
 * (Oreo, Kinder…) à part, facultatives, repliées.
 */
function BlocGouts({
  choix,
  attendus,
  gouts,
  decorations,
  options,
  onGouts,
  onDecorations,
  onGoutChoisi,
}: {
  choix: ChoixGout;
  attendus: number;
  gouts: readonly string[];
  decorations: readonly string[];
  options: OptionsGateau | null;
  onGouts: (gouts: string[]) => void;
  onDecorations: (decorations: string[]) => void;
  /** Tous les goûts choisis d'un toucher (pas pendant la frappe d'« Autre… »). */
  onGoutChoisi?: () => void;
}) {
  const liste = (choix.liste === 'entremet' ? options?.entremets : options?.parfums) ?? [];
  // Bavarois : les goûts que le magasin fait déjà d'abord, puis la liste du manager.
  const noms = ordonnerGouts(choix.goutsEnTete, liste.filter((o) => o.actif !== false).map((o) => o.nom));
  const [tout, setTout] = useState(false);
  const [libre, setLibre] = useState<number | null>(null);
  const [deco, setDeco] = useState(decorations.length > 0);
  const nomsDeco = (options?.decorations ?? []).filter((o) => o.actif !== false && o.nom !== 'Sans décoration').map((o) => o.nom);

  const choisir = (etage: number, nom: string) => {
    const suivants = Array.from({ length: attendus }, (_, k) => gouts[k] ?? '');
    suivants[etage] = suivants[etage] === nom ? '' : nom;
    onGouts(suivants);
    if (suivants[etage] && suivants.every(Boolean)) onGoutChoisi?.();
  };
  const titre = (etage: number) =>
    attendus > 1 ? `Goût de l’étage ${etage + 1}` : choix.liste === 'entremet' ? 'Quel entremet\u00a0?' : 'Goût\u00a0?';
  const pastille = (actif: boolean) =>
    `min-h-11 rounded-lg border-2 px-2.5 text-sm font-medium leading-tight ${
      actif ? 'border-accent bg-accent-doux text-accent' : 'border-line-fort bg-surface text-ink'
    }`;

  return (
    <div className="mt-2 grid gap-2 rounded-lg border-l-4 border-accent bg-surface-2 px-2.5 py-2">
      {Array.from({ length: attendus }, (_, etage) => {
        const choisi = gouts[etage] ?? '';
        const visibles = tout ? noms : noms.slice(0, GOUTS_VISIBLES);
        // Un goût choisi hors des premiers (ou libre) reste visible et coché.
        const enPlus = choisi && !visibles.includes(choisi) ? [choisi] : [];
        return (
          <div key={etage} role="group" aria-label={titre(etage)}>
            <p className="mb-1 text-sm font-semibold text-ink">
              {titre(etage)}
              {choisi ? <span className="ml-1 font-bold text-accent">— {choisi}</span> : null}
            </p>
            <div className="flex flex-wrap gap-1">
              {[...visibles, ...enPlus].map((nom) => (
                <button key={nom} type="button" aria-pressed={choisi === nom} onClick={() => choisir(etage, nom)} className={pastille(choisi === nom)}>
                  {nom}
                </button>
              ))}
              {noms.length > GOUTS_VISIBLES ? (
                <button type="button" onClick={() => setTout((v) => !v)} className="min-h-11 rounded-lg px-2.5 text-sm text-ink-2 underline underline-offset-2">
                  {tout ? 'Moins' : `+ ${noms.length - GOUTS_VISIBLES} autres`}
                </button>
              ) : null}
              <button type="button" onClick={() => setLibre(libre === etage ? null : etage)} className="min-h-11 rounded-lg px-2.5 text-sm text-ink-2 underline underline-offset-2">
                Autre…
              </button>
              <button
                type="button"
                aria-pressed={choisi === GOUT_AU_CHOIX}
                onClick={() => choisir(etage, GOUT_AU_CHOIX)}
                className={pastille(choisi === GOUT_AU_CHOIX)}
              >
                {GOUT_AU_CHOIX}
              </button>
            </div>
            {libre === etage ? (
              <input
                className={`${CHAMP_TEXTE} mt-1`}
                value={noms.includes(choisi) || choisi === GOUT_AU_CHOIX ? '' : choisi}
                onChange={(e) => {
                  const suivants = Array.from({ length: attendus }, (_, k) => gouts[k] ?? '');
                  suivants[etage] = e.target.value;
                  onGouts(suivants);
                }}
                placeholder={choix.liste === 'entremet' ? 'Autre recette' : 'Chocolat caramel…'}
                autoComplete="off"
                aria-label={`${titre(etage)} — autre`}
              />
            ) : null}
          </div>
        );
      })}

      {nomsDeco.length > 0 ? (
        <div role="group" aria-label="Décoration (facultatif)">
          <button type="button" onClick={() => setDeco((v) => !v)} className="text-sm text-ink-2 underline underline-offset-2">
            Décoration (facultatif){decorations.length ? ` — ${decorations.join(', ')}` : ''} {deco ? '▴' : '▾'}
          </button>
          {deco ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {nomsDeco.map((nom) => {
                const actif = decorations.includes(nom);
                return (
                  <button
                    key={nom}
                    type="button"
                    aria-pressed={actif}
                    onClick={() => onDecorations(actif ? decorations.filter((d) => d !== nom) : [...decorations, nom])}
                    className={pastille(actif)}
                  >
                    {nom}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Nombre de chiffres ou lettres proposé en gros boutons (au-delà : « Autre », au pavé). */
const NOMBRES_DE_SYMBOLES = [1, 2, 3, 4] as const;

/**
 * Number Cake (propriétaire, 22/10/2026 ; vocabulaire « chiffres ou lettres »,
 * 28/10/2026), sans pavé ni engrenage :
 * 1. « Combien de chiffres ou lettres ? » en gros boutons ;
 * 2. « Quels chiffres ou lettres ? » — le nombre SUIT ce qui est tapé (« 25 »,
 *    « 2 5 », « 2-5 » → 2, compté par le domaine) ; toucher un autre nombre
 *    vide le texte (à retaper). « Autre dessin » (cœur, étoile…) : texte libre,
 *    non compté, qui fait imprimer la zone de dessin ;
 * 3. la taille (boutons à partir du minimum), puis seulement le prix.
 */
function BlocFormes({
  ligne,
  onChange,
  paveOuvert,
  ouvrirPave,
  fermerPave,
  onAutreForme,
}: {
  ligne: LigneEcran;
  onChange: (p: Partial<LigneEcran>) => void;
  paveOuvert: boolean;
  ouvrirPave: () => void;
  fermerPave: () => void;
  onAutreForme: () => void;
}) {
  const autre = ligne.formesLibres === true;
  const n = ligne.nbSymboles;
  const horsBoutons = n !== null && !(NOMBRES_DE_SYMBOLES as readonly number[]).includes(n);
  const apercu = formesAImprimer(ligne.formes);

  return (
    <div className="grid gap-2 rounded-lg border-l-4 border-accent bg-surface-2 px-2.5 py-2">
      <div>
        <p className="mb-1 text-sm font-semibold text-ink">Combien de chiffres ou lettres&nbsp;?</p>
        <div role="group" aria-label="Nombre de chiffres ou lettres" className="grid grid-cols-5 gap-1">
          {NOMBRES_DE_SYMBOLES.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={n === k}
              onClick={() => {
                onChange(choisirNombreSymboles(ligne, k));
                fermerPave();
              }}
              className={`chiffres min-h-12 rounded-lg border-2 text-lg font-semibold ${
                n === k ? 'border-accent bg-accent-doux text-accent' : 'border-line-fort bg-surface text-ink'
              }`}
            >
              {k}
            </button>
          ))}
          <button
            type="button"
            aria-expanded={paveOuvert}
            onClick={ouvrirPave}
            className={`min-h-12 rounded-lg border-2 text-sm ${
              horsBoutons ? 'chiffres border-accent bg-accent-doux font-semibold text-accent' : 'border-line bg-surface text-ink-2'
            }`}
          >
            {horsBoutons ? n : 'Autre'}
          </button>
        </div>
      </div>

      {n !== null ? (
        <div>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink">{autre ? 'Quel dessin\u00a0?' : 'Quels chiffres ou lettres\u00a0?'}</span>
            <input
              className={CHAMP_TEXTE}
              value={ligne.formes}
              onChange={(e) => onChange(ecrireChiffresOuLettres(ligne, e.target.value))}
              placeholder={autre ? 'cœur + 1, étoile…' : n === 1 ? '5' : n === 2 ? '25' : 'Chiffres ou lettres'}
              autoComplete="off"
              autoCapitalize="characters"
              aria-label={autre ? 'Dessin à réaliser' : 'Chiffres ou lettres à réaliser'}
            />
          </label>
          {apercu ? (
            <p className="mt-1 text-sm text-ink-2">
              Au bon&nbsp;: <b className="whitespace-pre text-base text-ink">{apercu}</b>
            </p>
          ) : null}
          <Case
            compact
            coche={autre}
            onChange={(v) => {
              onChange(basculerFormesLibres(ligne, v));
              if (v) onAutreForme();
            }}
          >
            Autre dessin (cœur, étoile…) — zone de dessin sur le bon
          </Case>
        </div>
      ) : null}
    </div>
  );
}

/** Une ligne du bon, compacte : champs chiffrés (pavé dans la colonne), total de ligne, précision repliable. */
function LigneDuBon({
  ligne,
  fiche,
  ficheGateau,
  tailleCourante,
  prixTaille,
  onTaille,
  resultat,
  unite,
  actif,
  setActif,
  detail,
  basculerDetail,
  options,
  tailles,
  unGateau = false,
  onChange,
  onRetirer,
  retirable = true,
  onGerantLibre,
  onAutreForme,
  onRetirerPhoto,
  onGoutChoisi,
}: {
  ligne: LigneEcran;
  fiche: FicheTarifee | null;
  /** Gâteau sur commande de la ligne (elle-même, ou son origine si remplacée par le comptoir, R60). */
  ficheGateau: FicheTarifee | null;
  /** Taille (parts) choisie, y compris quand la ligne est le gâteau du comptoir. */
  tailleCourante: number | null;
  /** Prix du gâteau du comptoir à cette taille (catalogue), null s'il n'y en a pas. */
  prixTaille: (parts: number) => number | null;
  onTaille: (parts: number) => void;
  resultat: Resultat<LigneControlee> | null;
  unite: string;
  actif: string | null;
  setActif: (a: string | null) => void;
  detail: boolean;
  basculerDetail: () => void;
  options: OptionsGateau | null;
  /** Tailles standard des gâteaux simples (réglages du gérant, LOI 11). */
  tailles: readonly number[];
  /** Gâteau du comptoir (Bavarois 6P…) : une ligne = UN gâteau, pas de pavé de quantité (28/10/2026). */
  unGateau?: boolean;
  onChange: (p: Partial<LigneEcran>) => void;
  onRetirer: () => void;
  /** false : pas de × (supplément Écriture d'une écriture saisie, 28/10/2026). */
  retirable?: boolean;
  onGerantLibre: () => void;
  /** Number Cake « autre dessin » : la zone de dessin s'imprime pour l'atelier. */
  onAutreForme: () => void;
  /** Retire la photo de modèle de la ligne (la ligne reste). */
  onRetirerPhoto: () => void;
  /** Goût choisi (tous les étages) : l'écran peut montrer l'étape suivante. */
  onGoutChoisi?: () => void;
}) {
  const id = (champ: string) => `${ligne.cle}.${champ}`;
  const basculer = (champ: string) => setActif(actif === id(champ) ? null : id(champ));
  const libre = ligne.produitId === null;
  const regime = fiche?.produit.regimePrix ?? null;
  const plancher = regime === 'C' && fiche?.prix.prixEstPlancher === true;
  const auKilo = fiche?.produit.unite === 'kg';
  const controlee = resultat?.ok ? resultat.donnees : null;
  // R62 : le goût d'un gâteau sur commande a son propre bloc ; la précision reste libre.
  const goutAPart = ficheGateau !== null && GOUTS_SUR_COMMANDE[ficheGateau.produit.id] !== undefined;
  const suggestions = regime === 'B' ? options?.garnitures : regime === 'C' && !goutAPart ? options?.parfums : undefined;
  // LOI 11 : gâteau simple sur commande (données de la fiche, jugées par le
  // domaine) → la taille se choisit d'abord aux boutons des tailles standard.
  // R61 : gâteau à minimum (Layer, Number Cake, pièces montées) → tailles de 5
  // en 5 à partir de SON minimum (domaine) ; raccourcis, « Autre » reste libre.
  const simple = ficheGateau !== null && estGateauSimpleSurCommande(ficheGateau);
  const taillesLigne = simple ? tailles : ficheGateau ? taillesAPartirDuMinimum(ficheGateau, ligne.nbSymboles) : [];
  const parTailles = taillesLigne.length > 0;
  const taillesTriees = [...taillesLigne].sort((a, b) => a - b);
  // Number Cake (donnée : minimum PAR forme), jamais déduit du nom.
  const aFormes = fiche?.prix.minParSymbole != null;
  // R62 : goût demandé par le gâteau COMMANDÉ (donnée) — y compris quand la
  // ligne est devenue le gâteau du comptoir à cette taille (R60, ficheGateau).
  const choixGout = ficheGateau ? (GOUTS_SUR_COMMANDE[ficheGateau.produit.id] ?? null) : null;
  // R63 : formes proposées pour CE gâteau à CETTE taille (donnée REGLES_FORME, jugée
  // par le domaine) — [] non concerné, Carré + Rond jusqu'au seuil, Carré seul au-dessus.
  const formes: Forme[] =
    ficheGateau && tailleCourante !== null ? formesPossibles(ficheGateau.produit.id, tailleCourante, REGLES_FORME) : [];
  // R64 : supplément par personne (Pâte à sucre) — ses parts suivent le gâteau, pas de pavé.
  const parPersonne = fiche !== null && estSupplementParPersonne({ famille: fiche.produit.famille, basePrix: fiche.prix.basePrix });

  const [signalementTarif, setSignalementTarif] = useState<Echec | 'ok' | null>(null);
  const signalerAuGerant = async () => {
    if (ligne.prixUnitaireCentimes === null) return;
    try {
      const r = await lireReponse(
        await fetch('/api/tarifs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nom: ligne.libelleLibre, prixCentimes: ligne.prixUnitaireCentimes }),
        }),
      );
      setSignalementTarif(r.ok ? 'ok' : r);
    } catch {
      const e = echecReseau();
      if (!e.ok) setSignalementTarif(e);
    }
  };

  return (
    <div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {libre ? (
            <input
              id={`libelle-${ligne.cle}`}
              value={ligne.libelleLibre}
              onChange={(e) => onChange({ libelleLibre: e.target.value })}
              aria-label="Libellé de la demande"
              placeholder="Décrire la demande"
              className={CHAMP_TEXTE}
            />
          ) : (
            <p className="break-words text-base font-semibold leading-snug text-ink">{fiche ? libelleLigneEcran(ligne, fiche, LIBELLES_SELON_GOUT) : 'Produit absent du tarif'}</p>
          )}
          <p className="text-xs text-ink-2">{libelleRegime(fiche, libre)}</p>
          {ligne.photoModele ? (
            <div className="mt-1.5 flex items-center gap-2">
              <VignettePhotoLigne key={ligne.photoModele} id={ligne.photoModele} />
              <span className="chiffres text-base font-semibold text-ink">Photo {ligne.photoModele}</span>
              <button
                type="button"
                onClick={onRetirerPhoto}
                aria-label={`Retirer la photo ${ligne.photoModele} (la ligne reste)`}
                className="min-h-12 rounded-xl px-2 text-sm text-ink-2 underline underline-offset-2"
              >
                Retirer la photo
              </button>
            </div>
          ) : null}
        </div>
        {retirable ? (
          <button
            type="button"
            onClick={onRetirer}
            className="min-h-12 min-w-12 shrink-0 rounded-xl border border-line text-2xl leading-none text-ink-3 hover:text-bloquant"
            aria-label="Retirer la ligne"
          >
            ×
          </button>
        ) : (
          <span className="shrink-0 self-center text-xs text-ink-2">avec l’écriture</span>
        )}
      </div>

      {libre ? (
        // « C'est un gâteau ? » (audit du 28/10/2026) : réponse explicite, jamais déduite du libellé (LOI 6).
        <div role="group" aria-label="C’est un gâteau ?" className="mt-2 flex items-center gap-1">
          <span className="mr-1 text-sm font-semibold text-ink">C’est un gâteau&nbsp;?</span>
          {([true, false] as const).map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={ligne.gateauLibre === v}
              onClick={() =>
                onChange(
                  v
                    ? // Gâteau : la quantité devient des PARTS, à saisir.
                      { gateauLibre: true, quantite: ligne.gateauLibre === true ? ligne.quantite : null }
                    : // Pas un gâteau : ni goût ni décoration (sinon relu comme un gâteau).
                      { gateauLibre: false, gouts: [], decorations: [] },
                )
              }
              className={`min-h-11 min-w-16 rounded-lg border-2 px-3 text-base font-semibold ${
                ligne.gateauLibre === v ? 'border-accent bg-accent-doux text-accent' : 'border-line-fort bg-surface text-ink'
              }`}
            >
              {v ? 'Oui' : 'Non'}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-2 grid gap-1.5">
        {aFormes ? (
          <BlocFormes
            ligne={ligne}
            onChange={onChange}
            paveOuvert={actif === id('symboles')}
            ouvrirPave={() => basculer('symboles')}
            fermerPave={() => setActif(null)}
            onAutreForme={onAutreForme}
          />
        ) : null}
        {/* Number Cake : rien d'autre tant que le nombre de formes n'est pas donné
            (propriétaire, 22/10/2026 — on ne passe pas au prix avec une ligne en erreur). */}
        {aFormes && ligne.nbSymboles === null ? null : parTailles ? (
          <div role="group" aria-label="Taille du gâteau (parts)" className="grid grid-cols-5 gap-1">
            {taillesTriees.map((t) => {
              // R60 : taille qui existe au comptoir → prix du comptoir affiché (catalogue).
              const prixComptoir = prixTaille(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tailleCourante === t}
                  aria-label={prixComptoir === null ? `${t} parts` : `${t} parts · ${formaterEuros(prixComptoir)}`}
                  onClick={() => {
                    onTaille(t);
                    setActif(null);
                  }}
                  className={`chiffres min-h-11 rounded-lg border-2 text-base font-semibold leading-tight ${
                    tailleCourante === t ? 'border-accent bg-accent-doux text-accent' : 'border-line-fort bg-surface text-ink'
                  }`}
                >
                  {t}
                  {prixComptoir === null ? null : (
                    <span className="block text-xs font-medium">{formaterEuros(prixComptoir)}</span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              aria-expanded={actif === id('quantite')}
              onClick={() => {
                // Gâteau du comptoir (R60) : « Autre » revient au gâteau sur commande, parts au pavé.
                if (ligne.origineSurCommande) {
                  onChange({ produitId: ligne.origineSurCommande, origineSurCommande: null, quantite: null, prixUnitaireCentimes: null });
                  setActif(id('quantite'));
                  return;
                }
                basculer('quantite');
              }}
              className={`min-h-11 rounded-lg border-2 text-sm ${
                !ligne.origineSurCommande && ligne.quantite !== null && !taillesTriees.includes(ligne.quantite)
                  ? 'chiffres border-accent bg-accent-doux font-semibold text-accent'
                  : 'border-line bg-surface text-ink-2'
              }`}
            >
              {!ligne.origineSurCommande && ligne.quantite !== null && !taillesTriees.includes(ligne.quantite) ? ligne.quantite : 'Autre'}
            </button>
          </div>
        ) : parPersonne ? (
          <p className="chiffres text-base text-ink">
            {ligne.quantite === null ? 'Parts du gâteau à choisir' : `${ligne.quantite} parts`}
            <span className="ml-1 text-sm text-ink-2">— autant que le gâteau</span>
          </p>
        ) : unGateau && !ligne.origineSurCommande ? (
          // Une ligne par gâteau (28/10/2026) : pas de pavé. Un 2e gâteau = un toucher de la carte.
          // Ligne ancienne « 2 × » : affichée telle quelle, le domaine propose « Séparer ».
          <p className="chiffres text-base font-semibold text-ink">
            {ligne.quantite !== null && ligne.quantite > 1 ? `${ligne.quantite} gâteaux` : '1 gâteau'}
          </p>
        ) : (
          <ChampPave
            libelle={auKilo ? 'Poids' : unite === 'parts' ? 'Parts' : 'Quantité'}
            valeur={ligne.quantite === null ? null : auKilo ? formaterQuantite('kg', ligne.quantite) : `${ligne.quantite} ${unite}`}
            ouvert={actif === id('quantite')}
            onBasculer={() => basculer('quantite')}
          />
        )}
        {formes.length > 0 ? (
          <div role="group" aria-label="Forme du gâteau" className="grid grid-cols-2 gap-1">
            {formes.map((fo) => {
              // Au-dessus du seuil, une seule forme : déjà choisie (carré d'office, domaine).
              const choisie = ligne.forme === fo || (formes.length === 1 && (ligne.forme ?? null) === null);
              return (
                <button
                  key={fo}
                  type="button"
                  aria-pressed={choisie}
                  onClick={() => onChange({ forme: fo })}
                  className={`min-h-12 rounded-lg border-2 text-lg font-semibold ${
                    choisie ? 'border-accent bg-accent-doux text-accent' : 'border-line-fort bg-surface text-ink'
                  }`}
                >
                  {LIBELLES_FORME[fo]}
                </button>
              );
            })}
            {formes.length === 1 ? (
              <p className="self-center text-sm text-ink-2">au-dessus de {REGLES_FORME.partsMaxRond} parts</p>
            ) : null}
          </div>
        ) : null}
        {/* Gâteau aux tailles : le prix n'apparaît qu'une fois la taille choisie. */}
        {(plancher || libre) && !(parTailles || aFormes ? ligne.quantite === null : false) ? (
          <ChampPave
            libelle={libre ? (ligne.gateauLibre ? 'Prix / part' : 'Prix unitaire') : unite === 'parts' ? 'Prix / pers.' : 'Prix à la pièce'}
            valeur={
              ligne.prixUnitaireCentimes !== null
                ? formaterEuros(ligne.prixUnitaireCentimes)
                : plancher && fiche
                  ? formaterEuros(fiche.prix.prixCentimes)
                  : null
            }
            ouvert={actif === id('prix')}
            onBasculer={() => basculer('prix')}
          />
        ) : null}
        {fiche?.prix.maxParUnite ? (
          <ChampPave
            libelle={`Nombre de ${fiche.prix.maxParUnite.objet || 'sandwichs'}`}
            valeur={ligne.nbObjets === null ? null : `${ligne.nbObjets}`}
            ouvert={actif === id('objets')}
            onBasculer={() => basculer('objets')}
          />
        ) : null}
      </div>

      {libre && ligne.gateauLibre === true ? (
        // Gâteau libre : goût exigé comme les autres gâteaux (décision n°8, 28/10/2026).
        <BlocGouts
          choix={CHOIX_GOUT_LIBRE}
          attendus={1}
          gouts={ligne.gouts}
          decorations={ligne.decorations}
          options={options}
          onGouts={(gouts) => onChange({ gouts })}
          onGoutChoisi={onGoutChoisi}
          onDecorations={(decorations) => onChange({ decorations })}
        />
      ) : null}

      {choixGout && ficheGateau && !(aFormes && ligne.nbSymboles === null) ? (
        <BlocGouts
          choix={choixGout}
          attendus={goutsAttendus(choixGout, ficheGateau)}
          gouts={ligne.gouts}
          decorations={ligne.decorations}
          options={options}
          onGouts={(gouts) => onChange({ gouts })}
          onGoutChoisi={onGoutChoisi}
          onDecorations={(decorations) => onChange({ decorations })}
        />
      ) : null}

      {controlee ? (
        <p className="chiffres mt-1.5 text-base font-semibold text-ink">{composantes(controlee, unite)}</p>
      ) : ligne.quantite === null ? (
        <p className="mt-1.5 text-sm text-ink-2">
          {aFormes && ligne.nbSymboles === null
            ? 'Touchez le nombre de chiffres ou lettres.'
            : parTailles
              ? 'Touchez une taille (parts).'
              : `Saisissez ${auKilo ? 'le poids' : 'la quantité'} au pavé.`}
        </p>
      ) : null}

      {ligne.deverrouillage ? (
        <p className="mt-1 text-sm text-ink-2">Accord de {ligne.deverrouillage.par} enregistré avec la commande.</p>
      ) : null}
      {ligne.deverrouillageTaille ? (
        <p className="mt-1 text-sm text-ink-2">Taille accordée par {ligne.deverrouillageTaille.par}.</p>
      ) : null}

      <button
        type="button"
        onClick={basculerDetail}
        aria-expanded={detail}
        className="mt-1 min-h-10 max-w-full break-words text-left text-sm text-ink-2 underline underline-offset-2"
      >
        {ligne.precision ? `Précision\u00a0: ${ligne.precision}` : regime === 'B' ? 'Garnitures, précision…' : goutAPart ? 'Précision…' : 'Parfum, précision…'}
      </button>

      {detail ? (
        <div>
          <input
            value={ligne.precision}
            onChange={(e) => onChange({ precision: e.target.value })}
            placeholder={regime === 'B' ? 'Garnitures, répartition…' : 'Parfum, forme, précision…'}
            aria-label="Précision imprimée sur le bon"
            className={`${CHAMP_TEXTE} mt-1`}
          />
          {suggestions && suggestions.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onChange({ precision: ligne.precision ? `${ligne.precision}, ${o.nom}` : o.nom })}
                  className="min-h-10 rounded-full border border-line-fort bg-surface px-3 text-sm text-ink-2"
                >
                  {o.nom}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {libre ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {ligne.deverrouillage ? null : (
            <Bouton variante="secondaire" onClick={onGerantLibre}>
              Accord du manager pour ce prix
            </Bouton>
          )}
          <Bouton
            variante="secondaire"
            disabled={ligne.prixUnitaireCentimes === null || ligne.libelleLibre.trim() === '' || signalementTarif === 'ok'}
            onClick={() => void signalerAuGerant()}
          >
            {signalementTarif === 'ok' ? 'Proposé au manager' : 'Proposer ce prix pour le tarif'}
          </Bouton>
        </div>
      ) : null}
      {signalementTarif && signalementTarif !== 'ok' ? (
        <ListeSignalements
          className="mt-2"
          signalements={[signalementTarif]}
          autreSortiePour={(s) => {
            const so = sortieDe(s);
            const libelle = so.libelle ?? so.autre;
            return libelle ? (
              <span className="inline-flex min-h-14 items-center rounded-xl border-2 border-line-fort px-4 text-base text-ink">
                {libelle}
              </span>
            ) : undefined;
          }}
        />
      ) : null}
    </div>
  );
}

/* ========================================================= Choix produits */

const MAX_CARTES = 60;
/** Au-delà de ce nombre de caractères, le nom d'une carte produit passe en plus petit (jamais coupé, LOI 5). */
const LONGUEUR_LIBELLE_LONG = 30;

/**
 * UNE grille de produits (plus d'onglets par régime), une recherche, des
 * filtres légers par rayon (repliés). Le régime de chaque produit est LU sur
 * la fiche et rappelé discrètement (« dès … /pers. », minimum).
 */
function GrilleProduits({
  tablette,
  zone,
  enTete,
  catalogue,
  lignes,
  recherche,
  onRecherche,
  rayon,
  onRayon,
  rayonsOuverts,
  onRayonsOuverts,
  eclair,
  sansGateau,
  onToucher,
  onAutreDemande,
  onPhotos,
}: {
  /** Tablette : familles toujours visibles, grille dense qui défile en interne (la page, jamais). */
  tablette: boolean;
  /** Zone qui défile (tablette) : sert à y revenir en haut depuis une sortie. */
  zone?: Ref<HTMLDivElement>;
  /** Affiché entre la barre de recherche et la grille (signalements des produits). */
  enTete?: ReactNode;
  catalogue: CatalogueCommande;
  lignes: LigneEcran[];
  recherche: string;
  onRecherche: (r: string) => void;
  rayon: string | null;
  onRayon: (r: string | null) => void;
  rayonsOuverts: boolean;
  onRayonsOuverts: (o: boolean) => void;
  eclair: Eclair | null;
  sansGateau: boolean;
  onToucher: (f: FicheCatalogue) => void;
  onAutreDemande: () => void;
  /** Ouvre la galerie des photos de modèles. */
  onPhotos: () => void;
}) {
  // Familles : « Salé » et « Gâteau » d'abord, en gros (libellés de bouton,
  // modele.ts) ; les autres rayons ensuite, plus discrets.
  const familles = boutonsFamilles(catalogue);
  const enAvant = familles.filter((b) => b.enAvant);
  const autres = familles.filter((b) => !b.enAvant);
  const fiches = fichesVisibles(catalogue, recherche, rayon);
  const libre = recherche.trim() === '' && rayon === null;
  const pucesVisibles = tablette || rayonsOuverts;
  const autreChoisie = autres.find((b) => b.rayon === rayon) ?? null;

  const barre = (
    <div className={tablette ? 'flex-none p-3 pb-2' : ''}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={recherche}
          onChange={(e) => onRecherche(e.target.value)}
          placeholder="Chercher un produit…"
          aria-label="Chercher un produit"
          autoComplete="off"
          className={`${CHAMP_TEXTE} min-w-0 flex-1 basis-40`}
        />
        {enAvant.map((b) => (
          <button
            key={b.rayon}
            type="button"
            aria-pressed={rayon === b.rayon}
            title={b.rayon}
            onClick={() => onRayon(rayon === b.rayon ? null : b.rayon)}
            className={`min-h-12 shrink-0 rounded-xl border-2 px-4 text-lg font-bold ${
              rayon === b.rayon
                ? 'border-accent bg-accent text-white shadow'
                : 'border-accent bg-accent-doux text-accent'
            }`}
          >
            {b.libelle}
          </button>
        ))}
        {tablette ? null : (
          <button
            type="button"
            aria-expanded={rayonsOuverts}
            onClick={() => onRayonsOuverts(!rayonsOuverts)}
            className={`min-h-12 rounded-xl border-2 px-3 text-sm font-medium ${autreChoisie ? 'border-accent bg-accent-doux text-accent' : 'border-line-fort bg-surface text-ink-2'}`}
          >
            {autreChoisie?.libelle ?? 'Familles'} {rayonsOuverts ? '▴' : '▾'}
          </button>
        )}
        <button
          type="button"
          onClick={onPhotos}
          className="min-h-12 shrink-0 rounded-xl border-2 border-accent bg-surface px-4 text-lg font-bold text-accent"
        >
          Photos
        </button>
        <button
          type="button"
          onClick={onAutreDemande}
          className="min-h-12 rounded-xl border-2 border-line-fort bg-surface px-3 text-sm font-medium text-ink"
        >
          Autre demande
        </button>
      </div>

      {pucesVisibles ? (
        // Tablette : une seule rangée de familles secondaires, qui glisse horizontalement
        // dans la colonne (jamais la page) ; « Salé » et « Gâteau » sont déjà en tête.
        <div
          role="group"
          aria-label="Autres familles"
          className={`mt-2 flex min-w-0 gap-1.5 ${tablette ? 'overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:thin]' : 'flex-wrap'}`}
        >
          <Puce actif={rayon === null} onClick={() => onRayon(null)}>Tout</Puce>
          {autres.map((b) => (
            <Puce key={b.rayon} actif={rayon === b.rayon} onClick={() => onRayon(rayon === b.rayon ? null : b.rayon)}>
              {b.libelle}
            </Puce>
          ))}
        </div>
      ) : null}
    </div>
  );

  const liste =
    fiches.length === 0 ? (
      <p className={`text-sm text-ink-2 ${tablette ? '' : 'mt-3'}`}>
        Aucun produit trouvé. Une demande hors liste se prend avec « Autre demande »
        {recherche.trim() ? ` (« ${recherche.trim()} » sera repris comme libellé)` : ''}.
      </p>
    ) : (
      <ul
        className={
          tablette
            ? 'grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2'
            : 'mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3'
        }
      >
        {fiches.slice(0, MAX_CARTES).map((f) => {
          const q = quantiteAuBon(lignes, f.produit.id);
          const auKilo = f.produit.unite === 'kg';
          const eclaire = eclair?.produitId === f.produit.id;
          const indisponible = estSupplement(f) && sansGateau;
          const pastille = q === null ? null : auKilo ? formaterQuantite('kg', q) : String(q);
          return (
            <li key={f.produit.id}>
              <button
                type="button"
                disabled={indisponible}
                onClick={() => onToucher(f)}
                aria-label={`${libelleProduit(f)}${pastille ? `, ${pastille} au bon` : ''}${indisponible ? ', ajoutez d’abord un gâteau' : ''}`}
                className={`relative flex w-full flex-col justify-between rounded-xl border-2 text-left transition duration-300 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
                  tablette ? 'h-full min-h-16 gap-0.5 px-2.5 py-1.5' : 'h-full min-h-20 gap-1 px-3 py-2'
                } ${
                  eclaire
                    ? 'border-accent bg-accent-doux ring-4 ring-accent/40'
                    : q !== null
                      ? 'border-accent bg-surface'
                      : 'border-line bg-surface hover:bg-surface-2'
                }`}
              >
                {/* LOI 5 : le nom du catalogue se lit EN ENTIER (jamais « … ») ; un nom long
                    passe à la ligne en plus petit. Les cartes d'une rangée gardent la même hauteur. */}
                <span
                  className={`break-words pr-6 font-medium text-ink ${
                    libelleProduit(f).length > LONGUEUR_LIBELLE_LONG
                      ? tablette
                        ? 'text-[13px] leading-tight'
                        : 'text-sm leading-snug'
                      : tablette
                        ? 'text-[15px] leading-tight'
                        : 'text-base leading-snug'
                  }`}
                >
                  {libelleProduit(f)}
                </span>
                <span className="chiffres text-sm leading-tight text-ink-2">
                  {indisponible ? (
                    'Ajoutez d’abord un gâteau'
                  ) : (
                    <>
                      <span className="font-semibold text-ink">
                        {f.prix.prixEstPlancher ? 'dès ' : ''}
                        {formaterEuros(f.prix.prixCentimes)}
                        {f.prix.basePrix === 'kg' ? '/kg' : f.prix.basePrix === 'personne' ? '/pers.' : ''}
                      </span>
                      {f.prix.minParSymbole !== null
                        ? ` · min. ${f.prix.minParSymbole} parts par chiffre ou lettre`
                        : f.prix.minQuantite !== null
                          ? ` · min. ${f.prix.minQuantite}`
                          : ''}
                    </>
                  )}
                </span>
                {pastille ? (
                  <span
                    className={`chiffres absolute -right-2 -top-2 flex h-8 min-w-8 items-center justify-center rounded-full bg-accent px-2 text-base font-bold text-white shadow transition-transform duration-300 ${
                      eclaire ? 'scale-125' : 'scale-100'
                    }`}
                    aria-hidden
                  >
                    {pastille}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    );

  const pied = (
    <>
      {fiches.length > MAX_CARTES ? (
        <p className="mt-2 text-sm text-ink-2">
          {fiches.length - MAX_CARTES} autres produits&nbsp;: affinez la recherche ou choisissez une famille.
        </p>
      ) : null}
      {libre ? (
        <p className="mt-2 text-sm text-ink-3">Comptoir&nbsp;: seuls les favoris sont affichés. Cherchez ou choisissez une famille pour les autres.</p>
      ) : null}
    </>
  );

  if (!tablette) {
    return (
      <div>
        {barre}
        {enTete}
        {liste}
        {pied}
      </div>
    );
  }
  // Tablette : barre et familles fixes ; la grille seule défile. La pastille
  // déborde de 8 px en haut à droite : marges internes pour ne pas la rogner.
  return (
    <>
      {barre}
      {enTete ? <div className="max-h-[40%] flex-none overflow-y-auto overscroll-contain px-3">{enTete}</div> : null}
      <div ref={zone} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-2">
        {liste}
        {pied}
      </div>
    </>
  );
}

/** Refus typé lu du serveur → échec affichable (format LOI 9, message du serveur tel quel). */
function echecDuServeur(r: { code: string; message: string; champ?: string; valeurProposee?: unknown }): Echec {
  return {
    ok: false,
    niveau: 'bloquant',
    code: (r.code.startsWith('ERR_') ? r.code : 'ERR_INATTENDUE') as Echec['code'],
    message: r.message,
    ...(r.champ !== undefined ? { champ: r.champ } : {}),
    ...(r.valeurProposee !== undefined ? { valeurProposee: r.valeurProposee } : {}),
  };
}

/* ====================================================== Commande gardée */

/** Pas de réseau : la commande est sur la tablette, elle partira toute seule. */
function CommandeGardee({
  modification,
  client,
  dateRetrait,
  heureRetrait,
  controlee,
  onNouvelle,
  onAccueil,
}: {
  modification: boolean;
  client: string;
  dateRetrait: string | null;
  heureRetrait: string;
  controlee: CommandeControlee | null;
  onNouvelle: () => void;
  onAccueil: () => void;
}) {
  return (
    <>
      <Entete
        titre={modification ? 'Changements gardés sur la tablette' : 'Commande gardée sur la tablette'}
        sousTitre={modification ? TEXTES_HORS_LIGNE.gardeeModification : TEXTES_HORS_LIGNE.gardee}
      />
      <Carte className="p-4">
        <p className="text-lg text-ink">
          {client} — retrait {dateRetrait ? `le ${formaterDate(dateRetrait)}` : 'à fixer'}, {texteHeureRetrait(heureRetrait)}
        </p>
        {controlee ? (
          <p className="chiffres mt-2 text-2xl font-bold text-ink">Total {formaterEuros(controlee.totalCentimes)}</p>
        ) : null}
        <p className="mt-3 text-base text-ink-2">{TEXTES_HORS_LIGNE.pasDImpression}</p>
        <p className="mt-1 text-sm text-ink-2">Le voyant en bas de l’écran indique quand elle est partie.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Bouton variante="principal" className="min-h-14 text-lg" onClick={onNouvelle}>
            Nouvelle commande
          </Bouton>
          <Bouton className="min-h-14" onClick={onAccueil}>
            Accueil
          </Bouton>
        </div>
      </Carte>
    </>
  );
}

/* ============================================================ Confirmation */

function Confirmation({
  validee,
  modification,
  client,
  dateRetrait,
  heureRetrait,
  onImprimer,
  onNouvelle,
  onRevoir,
}: {
  validee: Validee;
  modification: boolean;
  client: string;
  dateRetrait: string | null;
  heureRetrait: string;
  onImprimer: () => void;
  onNouvelle: () => void;
  /** Revenir à la commande pour la relire ou la corriger (déjà enregistrée : en modification). */
  onRevoir: () => void;
}) {
  const c = validee.controlee;
  return (
    <>
      <Entete titre={`Commande ${validee.numero} ${modification ? 'modifiée' : 'enregistrée'}`} sousTitre="Relisez-la au client à voix haute, s’il vous plaît." />
      <Carte className="p-4">
        <p className="text-lg text-ink">
          {client} — retrait {dateRetrait ? `le ${formaterDate(dateRetrait)}` : 'à fixer'}, {texteHeureRetrait(heureRetrait)}
        </p>
        {c ? (
          <>
            <ul className="mt-3 grid gap-1 text-base text-ink">
              {c.lignes.map((l, k) => (
                <li key={k} className="chiffres">
                  {l.libelle} : {composantes(l, l.basePrix === 'personne' ? 'parts' : 'pièces')}
                </li>
              ))}
            </ul>
            <p className="chiffres mt-3 text-3xl font-bold text-ink">Total {formaterEuros(c.totalCentimes)}</p>
            <p className="chiffres text-lg text-ink-2">
              Acompte {formaterEuros(c.acompteCentimes)} · reste {formaterEuros(c.resteDuCentimes)}
            </p>
          </>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Bouton variante="principal" className="min-h-14 text-lg" onClick={onImprimer}>
            Imprimer le bon
          </Bouton>
          <Bouton className="min-h-14" onClick={onRevoir}>
            ← Revenir à la commande
          </Bouton>
          <Bouton className="min-h-14" onClick={onNouvelle}>
            Liste des commandes
          </Bouton>
        </div>
      </Carte>
      <RappelApresAction moment="apres_commande" declencheur={validee.id} className="mt-4" />
    </>
  );
}

/* ================================================================ Morceaux */

/**
 * Vignette de la photo de modèle d'une ligne (adresse lue en base, photo
 * masquée comprise : une commande déjà prise la garde). Tant que l'adresse
 * n'est pas connue, un carré vide de même taille : la ligne ne bouge pas.
 */
function VignettePhotoLigne({ id }: { id: string }) {
  const url = useUrlPhoto(id);
  const classe = 'h-12 w-12 shrink-0 rounded-lg border border-line object-cover';
  if (!url) return <span aria-hidden="true" className={`${classe} bg-surface-2`} />;
  // Images déjà allégées (640 px) : servies telles quelles, sans passage par l'optimiseur.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" loading="lazy" decoding="async" className={classe} />;
}

function BoutonSortie({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-14 w-full items-center justify-center rounded-xl border-2 border-sortie bg-surface px-5 text-lg font-semibold text-sortie sm:w-auto"
    >
      {children}
    </button>
  );
}

function Choix({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 rounded-xl border-2 px-4 text-base ${
        actif ? 'border-accent bg-accent-doux font-medium text-accent' : 'border-line-fort bg-surface text-ink-2'
      }`}
    >
      {children}
    </button>
  );
}

function Case({
  coche,
  onChange,
  desactive = false,
  aide,
  compact = false,
  children,
}: {
  coche: boolean;
  /** Espacement réduit (bloc « Gâteau », bas du bon) — la zone de toucher reste de 48 px. */
  compact?: boolean;
  onChange: (v: boolean) => void;
  desactive?: boolean;
  /** Petit texte sous la case (ex. « Ajoutez d’abord un gâteau »). */
  aide?: string;
  children: ReactNode;
}) {
  return (
    <label className={`${compact ? 'mt-0.5' : 'mt-3'} flex min-h-12 items-center gap-3 text-base ${desactive ? 'text-ink-3' : 'text-ink'}`}>
      <input
        type="checkbox"
        checked={coche}
        disabled={desactive}
        onChange={(e) => onChange(e.target.checked)}
        className="h-6 w-6 shrink-0 accent-[var(--accent)] disabled:opacity-50"
      />
      <span>
        {children}
        {aide ? <span className="block text-sm text-ink-2">{aide}</span> : null}
      </span>
    </label>
  );
}

/** Champ de la bande client (tablette) : libellé court + valeur, 48 px de haut. */
function BoutonBande({
  libelle,
  valeur,
  vide,
  actif,
  enErreur = false,
  aFaire = false,
  onClick,
  className = '',
  ariaLabel,
}: {
  libelle: string;
  valeur: string | null;
  vide: string;
  actif: boolean;
  enErreur?: boolean;
  /** Encore à renseigner : mis en avant (bord accent). */
  aFaire?: boolean;
  onClick: () => void;
  className?: string;
  ariaLabel: string;
}) {
  // Champ en erreur : le bord seul, en rouge (propriétaire, 28/10/2026 — pas de gros bloc).
  const bord = enErreur
    ? 'border-alerte bg-surface'
    : actif
      ? 'border-accent bg-accent-doux'
      : aFaire
        ? 'border-accent bg-surface'
        : 'border-line-fort bg-surface';
  return (
    <button
      type="button"
      aria-expanded={actif}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`flex min-h-12 min-w-0 items-center gap-2 rounded-xl border-2 px-3 text-left ${bord} ${className}`}
    >
      <span className="shrink-0 text-sm text-ink-2">{libelle}</span>
      <span className={`chiffres min-w-0 flex-1 truncate text-right text-base font-semibold ${valeur === null ? 'text-accent' : 'text-ink'}`}>
        {valeur ?? vide}
      </span>
    </button>
  );
}

/** Un des deux boutons d'un choix segmenté (Comptoir / Téléphone). */
function Segment({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={`min-h-10 rounded-lg px-3 text-sm ${actif ? 'bg-accent-doux font-semibold text-accent' : 'text-ink-2'}`}
    >
      {children}
    </button>
  );
}

function Puce({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={`min-h-10 shrink-0 whitespace-nowrap rounded-full border-2 px-3 text-sm ${actif ? 'border-accent bg-accent-doux font-medium text-accent' : 'border-line-fort bg-surface text-ink-2'}`}
    >
      {children}
    </button>
  );
}
