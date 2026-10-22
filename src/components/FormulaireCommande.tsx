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
} from 'react';
import { Bouton, Carte, Chargement, Entete } from '@/components/ui';
import { useEquipe } from '@/lib/vendeurs';
import type { Commande, ModePaiement, Origine } from '@/lib/commandes';
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
  type CommandeControlee,
  type ContexteCommande,
  type LigneControlee,
} from '@/domaine/commande';
import { ajouterJoursOuvres, fermetureDuJour, formaterDate, prochainJourOuvert } from '@/domaine/calendrier';
import { formaterEuros, resteDu, somme } from '@/domaine/argent';
import { formaterQuantite } from '@/domaine/unites';
import { libelleCorrection } from '@/domaine/messages';
import { horairesOuvertureDuJour, validerJourMeme, validerLendemain } from '@/domaine/reglement';
import { estGateauSimpleSurCommande, taillesAPartirDuMinimum, taillesProches } from '@/domaine/minimums';
import { formesAImprimer } from '@/lib/ticketCanvas';
import { FAMILLES_GATEAU, JOURS_AVANT_ARCHIVAGE } from '@/domaine/constantes';
import { CORRESPONDANCES_COMPTOIR } from '@/catalogue/correspondancesComptoir';
import { GOUTS_SUR_COMMANDE } from '@/catalogue/goutsSurCommande';
import { GOUT_AU_CHOIX, goutsAttendus, type ChoixGout } from '@/domaine/gouts';
import { gateauSurCommandeDe } from '@/domaine/prixComptoir';
import type { Echec, Resultat } from '@/domaine/resultat';
import type { Deverrouillage, FicheTarifee } from '@/domaine/types';
import {
  champLocal,
  choisirTaille,
  echecReseau,
  ficheComptoirPourTaille,
  gateauDeLaLigne,
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
  basculerSupplement,
  indexPremierGateau,
  precisionsAEnregistrer,
  saisirEcriture,
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
import { ChampPave } from '@/components/commande/ChampPave';
import { AccesGerant } from '@/components/commande/AccesGerant';
import { BandeRetrait } from '@/components/commande/BandeRetrait';

const CHAMP_TEXTE =
  'min-h-12 w-full rounded-xl border-2 border-line-fort bg-surface px-3 text-base text-ink placeholder:text-ink-3';
const TITRE = 'mb-3 text-base font-semibold text-ink';

/** Unité affichée d'une quantité en pièces : parts pour un prix par personne (donnée du catalogue). */
function uniteDe(fiche: FicheTarifee | null): string {
  return fiche?.prix.basePrix === 'personne' ? 'parts' : 'pièces';
}

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

/* ======================================================================== */

export function FormulaireCommande({ commande }: { commande?: Commande }) {
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
  const [lignes, setLignes] = useState<LigneEcran[]>(() => (commande ? lignesDepuisCommande(commande) : []));
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
  const [texteGateau, setTexteGateau] = useState(commande?.texteGateau ?? '');
  const [sansEcriture, setSansEcriture] = useState(commande?.sansEcriture ?? false);
  const [photoWhatsapp, setPhotoWhatsapp] = useState(commande?.photoWhatsapp ?? false);
  // « Photo à imprimer » = présence du supplément Photo au bon (18/10/2026).
  // Seule exception : une commande enregistrée cochée SANS ligne de supplément
  // (antérieure à l'automatisme) garde sa case jusqu'à ce qu'on la décoche.
  const [photoHeritee, setPhotoHeritee] = useState(
    () =>
      !!commande?.photoImprimee &&
      !commande.lignes.some((l) => l.produitCatalogue?.cleCatalogue === SUPPLEMENT_PHOTO),
  );
  const [demandeInhabituelle, setDemandeInhabituelle] = useState(commande?.demandeInhabituelle ?? false);
  // Zone « dessin, précisions » sur les bons internes : seulement si demandée
  // (21/10/2026). Ancienne commande sans le champ : non.
  const [zoneDessin, setZoneDessin] = useState(commande?.zoneDessin === true);
  const [remarques, setRemarques] = useState(commande?.remarques ?? '');

  // --- Interface -----------------------------------------------------------
  const [actif, setActif] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [rayon, setRayon] = useState<string | null>(null);
  const [rayonsOuverts, setRayonsOuverts] = useState(false);
  const [eclair, setEclair] = useState<Eclair | null>(null);
  const [ligneDetail, setLigneDetail] = useState<string | null>(null);
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
  const [refusServeur, setRefusServeur] = useState<Echec | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [validee, setValidee] = useState<Validee | null>(null);
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
      if (r.ok) setCatalogue(r.donnees);
      else setRefusChargement(r);
    } catch {
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
          setRefusChargement(r);
          return;
        }
        setCal(r.donnees);
        await chargerCatalogue(datePrix ?? r.donnees.aujourdhui);
      } catch {
        const e = echecReseau();
        if (!annule && !e.ok) setRefusChargement(e);
      }
    })();
    fetch('/api/gateaux')
      .then((r) => (r.ok ? r.json() : null))
      .then((o: OptionsGateau | null) => {
        if (!annule && o && Array.isArray(o.parfums)) setOptions(o);
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [chargerCatalogue, datePrix]);

  useEffect(() => {
    if (prete && !vendeur) router.replace('/commandes');
  }, [prete, vendeur, router]);

  // --- Domaine ---------------------------------------------------------------
  // Gâteaux au bon (R7, compté par le domaine sur les données, jamais par le
  // nom) : ils décident du bloc « Gâteau » et des suppléments au forfait.
  const famillesGateau = cal?.reglement.famillesGateau ?? FAMILLES_GATEAU;
  const nbGateaux = cal ? gateauxAuBon(lignes, catalogue, famillesGateau) : 0;
  const sansGateau = nbGateaux === 0;
  const iPremierGateau = indexPremierGateau(lignes, catalogue, famillesGateau);
  const photoImprimee = photoHeritee || aSupplement(lignes, SUPPLEMENT_PHOTO);
  // Sans gâteau, aucune précision « gâteau » ne part en base (bloc absent).
  const precisionsGateau = precisionsAEnregistrer({ texteGateau, sansEcriture, photoWhatsapp, photoImprimee }, nbGateaux);

  const etat: EtatFormulaire = {
    client,
    telephone,
    dateRetrait,
    heureRetrait,
    lignes,
    acompteCentimes: acompte,
    totalConvenuCentimes: totalConvenu,
    remise,
    texteGateau: precisionsGateau.texteGateau,
    sansEcriture: precisionsGateau.sansEcriture,
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
      ? lignes.map((l, i) => (l.quantite === null && l.produitId !== null ? null : controlerLigne(saisie.lignes[i], i, prise.datePrise, ctx)))
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
  const totalTarif = somme(lignesOk.map((l) => l.totalCentimes));
  const total = succesCommande?.donnees.totalCentimes ?? totalConvenu ?? totalTarif;
  const reste = resteDu(total, acompte ?? 0);

  // Délai : première date possible, calculée par le domaine (jours ouvrés).
  const delai = lignesOk.length > 0 ? Math.max(...lignesOk.map((l) => l.delaiJoursOuvres)) : 0;
  const premiereDate =
    cal ? prochainJourOuvert(ajouterJoursOuvres(cal.aujourdhui, delai, cal.joursFermes) ?? cal.aujourdhui, cal.joursFermes) ?? undefined : undefined;

  // --- Signalements par zone --------------------------------------------------
  const tous: SignalementAffichable[] = [...blocages, ...(succesCommande?.signalements ?? [])];
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
  const signauxGateau = pour(['texteGateau']);
  const signauxInhabituelle = pour(['demandeInhabituelle']);
  const signauxMontants = acompte !== null || tentative ? pour(['acompte', 'total']) : pour(['total']);
  const signauxStatut = pour(['statut']);

  // --- Actions -----------------------------------------------------------------
  const majLigne = (i: number, partiel: Partial<LigneEcran>) =>
    setLignes((ls) => ls.map((l, j) => (j === i ? majLigneEcran(l, partiel) : l)));
  const retirerLigne = (i: number) => setLignes((ls) => ls.filter((_, j) => j !== i));

  const avecGerant = (raison: string, appliquer: (d: Deverrouillage) => void) => {
    if (parGerant !== null) {
      appliquer({ par: parGerant, le: new Date().toISOString() });
      return;
    }
    setDemande({ raison, appliquer });
  };

  /** Un toucher = +1 (pièces ou parts) ; au kilo : pavé du poids. Le domaine juge la ligne aussitôt. */
  const toucher = (f: FicheCatalogue) => {
    const t = toucherProduit(lignes, f);
    setLignes(t.lignes);
    setActif(`${t.cle}.${t.champ}`);
    setEclair((e) => ({ cle: t.cle, produitId: f.produit.id, n: (e?.n ?? 0) + 1 }));
    const ligne = t.lignes.find((l) => l.cle === t.cle);
    const fiche = ficheDe(catalogue, f.produit.id);
    setAnnonce(
      t.champ === 'taille'
        ? f.prix.minParSymbole !== null && ligne?.nbSymboles == null
          ? `${libelleProduit(f)} au bon : combien de formes ?`
          : `${libelleProduit(f)} au bon : choisissez la taille`
        : ligne?.quantite != null && f.produit.unite !== 'kg'
          ? `${libelleProduit(f)} : ${ligne.quantite} ${uniteDe(fiche)} au bon`
          : `${libelleProduit(f)} ajouté au bon : saisissez le poids`,
    );
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
        setDemande({ raison: 'Commande prise avec l’ancien tarif : code du gérant pour la modifier.', appliquer: () => {} });
      } else if (ligne && ligne.produitId === null) {
        avecGerant(`Prix d’une demande hors catalogue : « ${ligne.libelleLibre || 'ligne libre'} ».`, (d) =>
          majLigne(i!, { deverrouillage: d }),
        );
      } else {
        setParGerant(null);
        setDemande({ raison: 'L’accès gérant a expiré : ressaisissez le code, puis validez à nouveau.', appliquer: () => {} });
      }
      return;
    }
    if (i !== null && ligne) {
      // Supplément sans gâteau, ou plus aucune place pour ce supplément : la sortie retire la ligne.
      if (s.code === 'ERR_SUPPLEMENT_SANS_GATEAU' || (s.code === 'ERR_SUPPLEMENT_TROP_NOMBREUX' && v === 0)) {
        return retirerLigne(i);
      }
      // R60 : la taille existe au comptoir → la ligne devient le gâteau du comptoir.
      if (s.code === 'ERR_PRIX_COMPTOIR' && ligne.quantite !== null) {
        const parts = ligne.quantite;
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
  const rendre = (liste: readonly SignalementAffichable[], unite = 'pièces', prefixe?: string): ReactNode =>
    liste.length === 0 ? null : (
      <ListeSignalements
        className="mt-3"
        prefixeId={prefixe}
        signalements={liste}
        libelleCorrectionPour={(s) => {
          // Taille hors standard : DEUX sorties (dessous / dessus), rendues plus bas.
          // Goût manquant (R62) : sortie « Au choix du pâtissier », rendue plus bas.
          if (s.code === 'ERR_TAILLE_NON_STANDARD' || s.code === 'ERR_GOUT_MANQUANT') return undefined;
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
            const f = l ? ficheDe(catalogue, l.produitId) : null;
            const n = l && f ? goutsAttendus(GOUTS_SUR_COMMANDE[f.produit.id], f) : 0;
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
                {libelleCorrection('ERR_DROIT_INSUFFISANT', { action: '', role: 'gérant' })}
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
                {libelleCorrection('ERR_DROIT_INSUFFISANT', { action: '', role: 'gérant' })}
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

  const valider = async () => {
    setTentative(true);
    setRefusServeur(null);
    setActif(null);
    if (!saisie || blocages.length > 0) {
      document.querySelector('[data-niveau="bloquant"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setEnvoi(true);
    try {
      const corps = {
        ...(modification ? { id: commande.id, action: 'modification', auteur: vendeur } : { vendeur }),
        client,
        telephone,
        origine,
        modePaiement,
        dateRetrait,
        heureRetrait: heureRetrait || null,
        acompteCentimes: acompte ?? 0,
        totalConvenuCentimes: totalConvenu,
        remise,
        texteGateau: precisionsGateau.texteGateau || null,
        sansEcriture: precisionsGateau.sansEcriture,
        photoWhatsapp: precisionsGateau.photoWhatsapp,
        photoImprimee: precisionsGateau.photoImprimee,
        demandeInhabituelle,
        zoneDessin,
        remarques: remarques || null,
        lignes: lignes.map((l, i) => ({ ...saisie.lignes[i], precision: l.precision || null, formes: l.formes.trim() || null, decorations: l.decorations })),
      };
      const r = await lireReponse<{ id: number; numero: string }>(
        await fetch('/api/commandes', {
          method: modification ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(corps),
        }),
      );
      if (!r.ok) {
        if (r.code === 'ERR_DROIT_INSUFFISANT') setParGerant(null);
        setRefusServeur(r);
        return;
      }
      setValidee({ id: r.donnees.id, numero: r.donnees.numero, controlee: succesCommande?.donnees ?? null });
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

  if (validee) {
    return (
      <Confirmation
        validee={validee}
        modification={modification}
        client={client}
        dateRetrait={dateRetrait}
        heureRetrait={heureRetrait}
        onImprimer={() => router.push(`/commandes/${validee.id}/imprimer`)}
        onNouvelle={() => router.push('/commandes')}
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
          sousTitre={`au moins ${cal.reglement.acomptePourcentageMin} % du total`}
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
          sousTitre={`Tarif : ${formaterEuros(totalTarif)}`}
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

  /* --------------------------------------------- Bloc « Gâteau » (sous le 1er gâteau) */
  // Demande du propriétaire (18/10/2026) : écriture et photos rattachées à la
  // ligne du gâteau. Champs au niveau de la commande : UN bloc, sous le premier
  // gâteau. Écrire / cocher la photo met le supplément au bon ; vider / décocher
  // le retire (le vendeur peut aussi retirer la ligne du supplément lui-même).
  const ecrire = (v: string) => {
    setTexteGateau(v);
    setLignes((ls) => saisirEcriture(ls, v, catalogue, famillesGateau));
  };
  const photoAuTarif = ficheDe(catalogue, SUPPLEMENT_PHOTO) !== null;
  const blocGateau = (
    <div
      role="group"
      aria-label="Sur le gâteau"
      className="mt-2 rounded-lg border-l-4 border-accent bg-surface-2 px-2.5 pb-1.5 pt-2"
    >
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink">Écriture sur le gâteau</span>
        <input
          className={CHAMP_TEXTE}
          value={sansEcriture ? '' : texteGateau}
          disabled={sansEcriture}
          onChange={(e) => ecrire(e.target.value)}
          placeholder={sansEcriture ? 'Pas d’écriture' : 'JOYEUX ANNIVERSAIRE MARIAM'}
          autoComplete="off"
        />
      </label>
      <p className="mt-1 text-xs text-ink-2">
        {!sansEcriture && texteGateau.trim() !== '' && aSupplement(lignes, SUPPLEMENT_ECRITURE)
          ? 'Supplément écriture au bon. '
          : ''}
        Relisez le texte au client : imprimé tel quel.
      </p>
      <Case
        compact
        coche={sansEcriture}
        onChange={(v) => {
          setSansEcriture(v);
          if (v) {
            setTexteGateau('');
            setLignes((ls) => basculerSupplement(ls, SUPPLEMENT_ECRITURE, false, catalogue, famillesGateau));
          }
        }}
      >
        Pas d’écriture
      </Case>
      <Case compact coche={photoWhatsapp} onChange={setPhotoWhatsapp}>
        Photo d’exemple envoyée sur WhatsApp
      </Case>
      <Case
        compact
        coche={photoImprimee}
        desactive={!photoAuTarif && !photoImprimee}
        aide={
          aSupplement(lignes, SUPPLEMENT_PHOTO)
            ? 'Supplément photo au bon'
            : !photoAuTarif
              ? 'Supplément « Photo » absent du tarif : prévenez le gérant'
              : undefined
        }
        onChange={(v) => {
          if (!v) setPhotoHeritee(false);
          setLignes((ls) => basculerSupplement(ls, SUPPLEMENT_PHOTO, v, catalogue, famillesGateau));
        }}
      >
        Photo à imprimer sur le gâteau
      </Case>
      {rendre(signauxGateau)}
    </div>
  );

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
              const unite = uniteDe(fiche);
              // Refus qui portent sur PLUSIEURS lignes (suppléments…) : `controlerLigne`
              // ne les voit pas, `blocagesCommande` si. Affichés sur la ligne dès sa
              // saisie, sans doubler le refus propre à la ligne.
              const blocagesLigne = r ? blocages.filter((b) => indexLigne(b.champ) === i && (r.ok || b.code !== r.code)) : [];
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
                      ficheComptoirPourTaille(gateauDeLaLigne(ligne), t, catalogue, CORRESPONDANCES_COMPTOIR)?.prix.prixCentimes ?? null
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
                    onChange={(p) => majLigne(i, p)}
                    onRetirer={() => retirerLigne(i)}
                    onGerantLibre={() =>
                      avecGerant(`Prix d’une demande hors catalogue : « ${ligne.libelleLibre || 'ligne libre'} ».`, (d) =>
                        majLigne(i, { deverrouillage: d }),
                      )
                    }
                    onAutreForme={() => setZoneDessin(true)}
                  />
                  {rendre(signaux, unite, `ligne-${ligne.cle}`)}
                  {i === iPremierGateau ? blocGateau : null}
                </li>
              );
            })}
          </ul>
        )}
        {lignesOk.length > 1 ? (
          <p className="chiffres mt-2 text-sm font-medium text-ink">
            {lignesOk.map((l) => formaterEuros(l.totalCentimes)).join(' + ')} = {formaterEuros(totalTarif)}
          </p>
        ) : null}
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
              onClick={() => avecGerant('Prix convenu sous le tarif (remise).', (d) => { setRemise(d); setActif('total'); })}
            >
              Prix convenu avec le client (accord du gérant)
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
          <span className="chiffres text-xl font-semibold text-ink">{formaterEuros(reste)}</span>
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
        {formaterEuros(total)}
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
  const signauxRetrait = [...signauxDate, ...signauxHeure];
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
        onToucher={toucher}
        onAutreDemande={ajouterLigneLibre}
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
            <Entete titre={titre} actions={<Bouton onClick={() => router.push('/commandes')}>Annuler</Bouton>} />
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
              <input
                ref={champClient}
                className="min-h-12 min-w-[8rem] flex-[1_1_10rem] rounded-xl border-2 border-line-fort bg-surface px-3 text-base text-ink placeholder:text-ink-3"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Nom du client"
                aria-label="Nom du client"
                autoComplete="off"
              />
              <BoutonBande
                libelle="Tél."
                valeur={telephone || null}
                vide="Toucher"
                actif={actif === 'telephone'}
                enErreur={signauxClient.some((s) => s.niveau === 'bloquant')}
                onClick={() => setActif(actif === 'telephone' ? null : 'telephone')}
                className="flex-[1_1_10rem]"
                ariaLabel={`Téléphone du client${telephone ? ` : ${telephone}` : ''}`}
              />
              <div role="group" aria-label="Commande prise" className="flex shrink-0 gap-0.5 rounded-xl border-2 border-line-fort bg-surface p-0.5">
                <Segment actif={origine === 'comptoir'} onClick={() => { setOrigine('comptoir'); setModePaiement('especes'); }}>
                  Comptoir
                </Segment>
                <Segment actif={origine === 'telephone'} onClick={() => { setOrigine('telephone'); setModePaiement('virement'); }}>
                  Téléphone
                </Segment>
              </div>
              <Bouton className="shrink-0" onClick={() => router.push('/commandes')}>Annuler</Bouton>
            </div>

            {/* Signalements qui ne tiennent pas dans la bande (rares : ils prennent sur la grille, jamais sur la page). */}
            {refusChargement || signauxStatut.length > 0 || signauxClient.length > 0 ? (
              <div className="max-h-[40%] flex-none overflow-y-auto overscroll-contain">
                {refusChargement ? rendre([refusChargement]) : null}
                {rendre(signauxStatut)}
                {rendre(signauxClient)}
              </div>
            ) : null}

            {/* ------------------------------------------ Zone de travail */}
            <div className={`flex min-h-0 flex-1 gap-3 ${gauche ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Produits */}
              <section aria-label="Produits" className="relative flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-line bg-surface">
                {/* Jour et heure de retrait : bande compacte, toujours visible, jamais par-dessus les produits. */}
                <div className="flex-none px-3 pt-3">{bande}</div>
                {grille(true, signauxProduits.length > 0 ? rendre(signauxProduits) : null)}

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
                        {lignes.length === 0 ? 'aucun produit' : `reste ${formaterEuros(reste)}`}
                      </div>
                    </div>
                    <span
                      className={`chiffres shrink-0 rounded-lg px-1.5 text-3xl font-bold leading-tight transition-colors duration-500 ${
                        eclair ? 'bg-accent-doux text-accent' : 'text-ink'
                      }`}
                    >
                      {formaterEuros(total)}
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
        actions={<Bouton onClick={() => router.push('/commandes')}>Annuler</Bouton>}
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
                    className={CHAMP_TEXTE}
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <ChampPave
                  libelle="Téléphone"
                  valeur={telephone || null}
                  ouvert={actif === 'telephone'}
                  onBasculer={() => setActif(actif === 'telephone' ? null : 'telephone')}
                  className="self-end"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Choix actif={origine === 'comptoir'} onClick={() => { setOrigine('comptoir'); setModePaiement('especes'); }}>
                  Au comptoir
                </Choix>
                <Choix actif={origine === 'telephone'} onClick={() => { setOrigine('telephone'); setModePaiement('virement'); }}>
                  Par téléphone
                </Choix>
              </div>
              {rendre(signauxClient)}
            </Carte>

            {/* ----------------------------------- Date et heure de retrait */}
            <Carte className="p-3">{bande}</Carte>

            {/* -------------------------------------------------- Produits */}
            <div ref={zoneProduits}>
              <Carte className="p-4">
                {grille(false)}
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

      {/* Téléphone, pavé fermé : total et validation toujours à portée de pouce. */}
      {cal && catalogue && !blocPave ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-2.5 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="chiffres text-2xl font-bold leading-tight text-ink">{formaterEuros(total)}</div>
              <div className="truncate text-sm text-ink-2">
                {lignes.length === 0 ? 'Aucun produit' : `reste ${formaterEuros(reste)}`}
                {blocages.length > 0 && tentative ? <span className="text-bloquant"> · à corriger</span> : null}
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

/** Commande enregistrée → lignes de l'écran (prix appliqués et accords conservés). */
function lignesDepuisCommande(c: Commande): LigneEcran[] {
  return c.lignes.map((l) => {
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
      gouts: l.gouts ?? [],
      decorations: l.decorations ?? [],
      nbObjets: l.nbObjets ?? null,
      precision: l.precision ?? '',
      deverrouillage: accordPar && accordLe ? { par: accordPar, le: accordLe } : null,
      // Taille hors standard déjà accordée (LOI 11) : renvoyée telle quelle, le
      // serveur ne la conserve que pour ce produit à cette quantité exacte.
      deverrouillageTaille: accordTaille(l),
      // R60 : gâteau du comptoir (1 pièce) qui remplace un gâteau sur commande →
      // les boutons de taille du gâteau d'origine restent affichés à la
      // modification. Plusieurs pièces (achat comptoir) : quantité au pavé, inchangée.
      origineSurCommande:
        l.quantite === 1 ? (gateauSurCommandeDe(produitId, CORRESPONDANCES_COMPTOIR)?.surCommande ?? null) : null,
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
  const unite = uniteDe(fiche);
  const plancher = fiche?.produit.regimePrix === 'C' && fiche.prix.prixEstPlancher === true;
  const nom = fiche ? libelleProduit(fiche) : ligne.libelleLibre || 'Autre demande';

  if (champ === 'symboles') {
    return (
      <PaveEntier
        libelle={`${nom} — nombre de formes`}
        contexte="commande"
        libelleUnite="formes"
        quantite={ligne.nbSymboles}
        onChange={(n) => onChange({ nbSymboles: n })}
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
        onValider={() => ouvrir(plancher || libre ? 'prix' : fiche?.prix.maxParUnite ? 'objets' : null)}
      />
    );
  }
  if (champ === 'prix' && (plancher || libre)) {
    return (
      <PaveMontant
        libelle={libre ? `${nom} — prix fixé avec le gérant` : `${nom} — prix par personne`}
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
}: {
  choix: ChoixGout;
  attendus: number;
  gouts: readonly string[];
  decorations: readonly string[];
  options: OptionsGateau | null;
  onGouts: (gouts: string[]) => void;
  onDecorations: (decorations: string[]) => void;
}) {
  const liste = (choix.liste === 'entremet' ? options?.entremets : options?.parfums) ?? [];
  const noms = liste.filter((o) => o.actif !== false).map((o) => o.nom);
  const [tout, setTout] = useState(false);
  const [libre, setLibre] = useState<number | null>(null);
  const [deco, setDeco] = useState(decorations.length > 0);
  const nomsDeco = (options?.decorations ?? []).filter((o) => o.actif !== false && o.nom !== 'Sans décoration').map((o) => o.nom);

  const choisir = (etage: number, nom: string) => {
    const suivants = Array.from({ length: attendus }, (_, k) => gouts[k] ?? '');
    suivants[etage] = suivants[etage] === nom ? '' : nom;
    onGouts(suivants);
  };
  const titre = (etage: number) =>
    attendus > 1 ? `Goût de l’étage ${etage + 1}` : choix.liste === 'entremet' ? 'Quel entremet ?' : 'Goût ?';
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

/** Nombre de formes proposé en gros boutons (au-delà : « Autre », au pavé). */
const NOMBRES_DE_FORMES = [1, 2, 3, 4] as const;

/** Chiffres et lettres seulement (« 25 », « AM ») : le nombre de formes s'en déduit. */
const FORMES_SIMPLES = /^[\p{L}\p{N}]+$/u;

/**
 * Number Cake (propriétaire, 22/10/2026), sans pavé ni engrenage :
 * 1. « Combien de formes ? » en gros boutons ;
 * 2. « Quelles formes ? » — chiffres ou lettres le plus souvent (« 25 » :
 *    le nombre de formes suit ce qui est tapé), ou « Autre forme » (cœur,
 *    étoile…) en texte libre, qui fait imprimer la zone de dessin ;
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
  const [autre, setAutre] = useState(() => ligne.formes.trim() !== '' && !FORMES_SIMPLES.test(ligne.formes.trim()));
  const n = ligne.nbSymboles;
  const horsBoutons = n !== null && !(NOMBRES_DE_FORMES as readonly number[]).includes(n);
  const apercu = formesAImprimer(ligne.formes);

  const ecrire = (texte: string) => {
    const t = texte.trim();
    // Chiffres ou lettres : le nombre de formes suit ce qui est écrit (« 25 » = 2).
    if (!autre && t !== '' && FORMES_SIMPLES.test(t)) onChange({ formes: texte, nbSymboles: [...t].length });
    else onChange({ formes: texte });
  };

  return (
    <div className="grid gap-2 rounded-lg border-l-4 border-accent bg-surface-2 px-2.5 py-2">
      <div>
        <p className="mb-1 text-sm font-semibold text-ink">Combien de formes ?</p>
        <div role="group" aria-label="Nombre de formes" className="grid grid-cols-5 gap-1">
          {NOMBRES_DE_FORMES.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={n === k}
              onClick={() => {
                onChange({ nbSymboles: k });
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
            <span className="mb-1 block text-sm font-semibold text-ink">Quelles formes ?</span>
            <input
              className={CHAMP_TEXTE}
              value={ligne.formes}
              onChange={(e) => ecrire(e.target.value)}
              placeholder={autre ? 'cœur + 1, étoile…' : n === 1 ? '5' : n === 2 ? '25' : 'Chiffres ou lettres'}
              autoComplete="off"
              autoCapitalize="characters"
              aria-label="Formes à réaliser"
            />
          </label>
          {apercu ? (
            <p className="mt-1 text-sm text-ink-2">
              Au ticket : <b className="whitespace-pre text-base text-ink">{apercu}</b>
            </p>
          ) : null}
          <Case
            compact
            coche={autre}
            onChange={(v) => {
              setAutre(v);
              if (v) onAutreForme();
            }}
          >
            Autre forme (cœur, étoile…) — zone de dessin au ticket
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
  onChange,
  onRetirer,
  onGerantLibre,
  onAutreForme,
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
  onChange: (p: Partial<LigneEcran>) => void;
  onRetirer: () => void;
  onGerantLibre: () => void;
  /** Number Cake « autre forme » : la zone de dessin s'imprime pour l'atelier. */
  onAutreForme: () => void;
}) {
  const id = (champ: string) => `${ligne.cle}.${champ}`;
  const basculer = (champ: string) => setActif(actif === id(champ) ? null : id(champ));
  const libre = ligne.produitId === null;
  const regime = fiche?.produit.regimePrix ?? null;
  const plancher = regime === 'C' && fiche?.prix.prixEstPlancher === true;
  const auKilo = fiche?.produit.unite === 'kg';
  const controlee = resultat?.ok ? resultat.donnees : null;
  // R62 : le goût d'un gâteau sur commande a son propre bloc ; la précision reste libre.
  const goutAPart = fiche !== null && GOUTS_SUR_COMMANDE[fiche.produit.id] !== undefined;
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
  // R62 : goût demandé par ce gâteau sur commande (donnée). Gâteau du comptoir : absent.
  const choixGout = fiche ? (GOUTS_SUR_COMMANDE[fiche.produit.id] ?? null) : null;

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
              value={ligne.libelleLibre}
              onChange={(e) => onChange({ libelleLibre: e.target.value })}
              aria-label="Libellé de la demande"
              placeholder="Décrire la demande"
              className={CHAMP_TEXTE}
            />
          ) : (
            <p className="text-base font-semibold leading-snug text-ink">{fiche ? libelleProduit(fiche) : 'Produit absent du tarif'}</p>
          )}
          <p className="text-xs text-ink-2">{libelleRegime(fiche, libre)}</p>
        </div>
        <button
          type="button"
          onClick={onRetirer}
          className="min-h-12 min-w-12 shrink-0 rounded-xl border border-line text-2xl leading-none text-ink-3 hover:text-bloquant"
          aria-label="Retirer la ligne"
        >
          ×
        </button>
      </div>

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
        ) : (
          <ChampPave
            libelle={auKilo ? 'Poids' : unite === 'parts' ? 'Parts' : 'Quantité'}
            valeur={ligne.quantite === null ? null : auKilo ? formaterQuantite('kg', ligne.quantite) : `${ligne.quantite} ${unite}`}
            ouvert={actif === id('quantite')}
            onBasculer={() => basculer('quantite')}
          />
        )}
        {/* Gâteau aux tailles : le prix n'apparaît qu'une fois la taille choisie. */}
        {(plancher || libre) && !(parTailles || aFormes ? ligne.quantite === null : false) ? (
          <ChampPave
            libelle={libre ? 'Prix unitaire' : unite === 'parts' ? 'Prix / pers.' : 'Prix à la pièce'}
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

      {choixGout && fiche && !(aFormes && ligne.nbSymboles === null) ? (
        <BlocGouts
          choix={choixGout}
          attendus={goutsAttendus(choixGout, fiche)}
          gouts={ligne.gouts}
          decorations={ligne.decorations}
          options={options}
          onGouts={(gouts) => onChange({ gouts })}
          onDecorations={(decorations) => onChange({ decorations })}
        />
      ) : null}

      {controlee ? (
        <p className="chiffres mt-1.5 text-base font-semibold text-ink">{composantes(controlee, unite)}</p>
      ) : ligne.quantite === null ? (
        <p className="mt-1.5 text-sm text-ink-2">
          {aFormes && ligne.nbSymboles === null
            ? 'Touchez le nombre de formes.'
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
        className="mt-1 min-h-10 max-w-full truncate text-left text-sm text-ink-2 underline underline-offset-2"
      >
        {ligne.precision ? `Précision : ${ligne.precision}` : regime === 'B' ? 'Garnitures, précision…' : goutAPart ? 'Précision (peu sucré, sans gluten…)' : 'Parfum, précision…'}
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
              Accord du gérant pour ce prix
            </Bouton>
          )}
          <Bouton
            variante="secondaire"
            disabled={ligne.prixUnitaireCentimes === null || ligne.libelleLibre.trim() === '' || signalementTarif === 'ok'}
            onClick={() => void signalerAuGerant()}
          >
            {signalementTarif === 'ok' ? 'Signalé au gérant' : 'Retenir pour le tarif (gérant)'}
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
                  tablette ? 'h-full min-h-16 gap-0.5 px-2.5 py-1.5' : 'min-h-20 gap-1 px-3 py-2'
                } ${
                  eclaire
                    ? 'border-accent bg-accent-doux ring-4 ring-accent/40'
                    : q !== null
                      ? 'border-accent bg-surface'
                      : 'border-line bg-surface hover:bg-surface-2'
                }`}
              >
                <span
                  className={`line-clamp-2 pr-6 font-medium text-ink ${tablette ? 'text-[15px] leading-tight' : 'text-base leading-snug'}`}
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
                        ? ` · min. ${f.prix.minParSymbole} parts/chiffre`
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
          {fiches.length - MAX_CARTES} autres produits : affinez la recherche ou choisissez une famille.
        </p>
      ) : null}
      {libre ? (
        <p className="mt-2 text-sm text-ink-3">Comptoir : seuls les favoris sont affichés. Cherchez ou choisissez une famille pour les autres.</p>
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

/* ============================================================ Confirmation */

function Confirmation({
  validee,
  modification,
  client,
  dateRetrait,
  heureRetrait,
  onImprimer,
  onNouvelle,
}: {
  validee: Validee;
  modification: boolean;
  client: string;
  dateRetrait: string | null;
  heureRetrait: string;
  onImprimer: () => void;
  onNouvelle: () => void;
}) {
  const c = validee.controlee;
  return (
    <>
      <Entete titre={`Commande ${validee.numero} ${modification ? 'modifiée' : 'enregistrée'}`} sousTitre="Relisez-la au client à voix haute." />
      <Carte className="p-4">
        <p className="text-lg text-ink">
          {client} — retrait le {dateRetrait ? formaterDate(dateRetrait) : '…'}
          {heureRetrait ? ` à ${heureRetrait}` : ''}
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
          <Bouton className="min-h-14" onClick={onNouvelle}>
            Retour aux commandes
          </Bouton>
        </div>
      </Carte>
      <RappelApresAction moment="apres_commande" declencheur={validee.id} className="mt-4" />
    </>
  );
}

/* ================================================================ Morceaux */

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
  const bord = enErreur
    ? 'border-bloquant bg-bloquant-doux'
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
