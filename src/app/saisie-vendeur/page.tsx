'use client';

// Comptage de fin de journée : ce qu'il reste sur l'étal, produit par produit.
//
// L'écran est utilisé debout, à une main, sur un téléphone ou une petite
// tablette. Comme aucune disposition ne convient à tout le monde, le vendeur
// règle la sienne une fois et l'appareil s'en souvient.
//
// Le découpage en pages voulu par le client est conservé. Par défaut ce sont
// des tranches de taille fixe qui suivent l'ordre affiché — un parcours dans
// le magasin reste donc suivi de bout en bout. Caler les pages sur les rayons
// reste possible, en option.
//
// LOI 2 : un produit au kilo se saisit au pavé décimal (poids en grammes),
// jamais au clavier ni par « +1 ». LOI 8 : les contrôles du domaine
// (src/domaine/inventaire.ts) s'affichent sur la ligne avec <Signalement>.
// LOI 10 : seuls les produits de la liste d'INVENTAIRE apparaissent ici.
// LOI 11 : un inventaire commencé avant l'heure de fermeture est signalé,
// sans bloquer ; un rappel d'équipe peut suivre l'inventaire terminé.
//
// Pavé : placé par `DispositionAvecPave` (à côté de la liste sur tablette,
// panneau bas sur téléphone), côté réglable (`BasculeCotePave`). La ligne du
// produit en cours reste toujours entièrement visible ; « Valider » ou Entrée
// passe au produit suivant et l'amène en vue.
//
// Fin d'inventaire (retour du propriétaire) : progression toujours visible en
// haut, « Aller au prochain non compté », « Terminer quand même » (liste ce
// qui manque, sans bloquer) et état de fin — « terminé » seulement quand tout
// est compté ET enregistré (`progression.ts`, `BandeauProgression`).
// Sur tablette, la page ne défile pas : seule la liste défile dans son cadre
// (`useHauteurSansDefilementPage`), lignes denses sur 1 à 3 colonnes selon la
// largeur réellement disponible à côté du pavé.
//
// Plein écran (retour du propriétaire : « Il ne faut PAS scroller ») : activé
// par défaut sur tablette (`pleinEcran.ts`), il ne garde que les onglets de
// pages, la grille de la page courante et le pavé (toujours ouvert). La grille
// est calculée pour que TOUS les produits de la page tiennent sans défilement
// (`dispositionGrille.ts`) ; une page trop longue est découpée en sous-pages.
// Onglets compacts (« P1 17/17 »), tous visibles, sur deux lignes si besoin.
// Colonne du pavé : « 87/123 », loupe, sortie, le pavé, puis le bilan de fin
// quand il y a quelque chose à dire — rien ne recouvre la grille.

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alerte, Bouton, Carte, Chargement, Entete, EtatVide } from '@/components/ui';
import { BandeauOnglets, Onglet } from '@/components/BandeauOnglets';
import { GestionParcours } from '@/components/GestionParcours';
import { IndicateurSauvegarde } from '@/components/IndicateurSauvegarde';
import { LigneSaisie } from '@/components/LigneSaisie';
import { PaveSaisieProduit } from '@/components/inventaire/PaveSaisieProduit';
import { focaliserLigne, useLigneActiveEnVue } from '@/components/inventaire/ligneActive';
import { DispositionAvecPave } from '@/components/saisie/DispositionAvecPave';
import { BasculeCotePave } from '@/components/saisie/BasculeCotePave';
import { SignalementsLigne } from '@/components/inventaire/SignalementsLigne';
import { BandeauProgression } from '@/components/inventaire/BandeauProgression';
import { useHauteurSansDefilementPage } from '@/components/inventaire/hauteurEcran';
import { usePleinEcranComptage, useTailleZone } from '@/components/inventaire/pleinEcran';
import { calculerDisposition, libelleSousPage, scinderEnSousPages } from '@/components/inventaire/dispositionGrille';
import { bilanFinInventaire, calculerProgression, prochainNonCompte } from '@/components/inventaire/progression';
import { RappelApresAction, RappelChargement } from '@/components/rappels';
import { Signalement } from '@/components/signalement';
import { RappelsService } from '@/components/RappelsService';
import { ReglagesSaisie } from '@/components/ReglagesSaisie';
import { SelecteurJournee } from '@/components/SelecteurJournee';
import { dateDuJour, formatDateLong } from '@/lib/dateProduction';
import { decouperEnPages, libellePage } from '@/lib/pagination';
import {
  additionnerRecomptage,
  controleDebutInventaire,
  controlesComptage,
  type SignalementLigne,
} from '@/lib/inventaire/controles';
import { formaterQuantite } from '@/domaine/unites';
import type { Niveau } from '@/domaine/resultat';
import { classerSelonParcours, useParcours } from '@/lib/parcours';
import { trierCategories } from '@/lib/postes';
import { usePreferencesSaisie } from '@/lib/preferencesSaisie';
import { useSaisieJournee, type Produit } from '@/lib/useSaisieJournee';

type Section = {
  cle: string;
  libelle: string;
  produits: Produit[];
  /** Plein écran : page découpée pour tenir sans défilement (« Page 1 · 1/2 »). */
  sousPage?: { index: number; total: number };
};

const GRAVITE: Record<Niveau, number> = { bloquant: 3, avertissement: 2, information: 1 };

export default function Comptage() {
  const [date, setDate] = useState(() => dateDuJour());
  const [indexSection, setIndexSection] = useState(0);
  const [recherche, setRecherche] = useState('');
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [selectionne, setSelectionne] = useState<number | null>(null);
  const [parcoursActif, setParcoursActif] = useState<string | null>(null);
  const [triImpose, setTriImpose] = useState(false);
  /** Produit en cours de RECOMPTAGE (déjà compté, retrouvé par la recherche). */
  const [recomptage, setRecomptage] = useState<number | null>(null);
  /** Produits déjà comptés quand la recherche a été ouverte : les retrouver = recompter. */
  const [comptesALaRecherche, setComptesALaRecherche] = useState<ReadonlySet<number>>(new Set());
  /** Avertissements nés sur cet écran (AVERT_DOUBLE_SCAN d'un recomptage). */
  const [avertissementsLocaux, setAvertissementsLocaux] = useState<Map<number, SignalementLigne[]>>(new Map());
  /** LOI 11 : contrôle de l'heure fait au premier geste de la journée. */
  const [debutControle, setDebutControle] = useState<{ date: string; signalements: SignalementLigne[] } | null>(null);
  const [termineLe, setTermineLe] = useState<string | null>(null);
  /** Journée pour laquelle l'employé a confirmé « Terminer quand même ». */
  const [termineQuandMemeLe, setTermineQuandMemeLe] = useState<string | null>(null);
  const [panneauFin, setPanneauFin] = useState(false);
  /** Haut de la zone de comptage (mesure de la hauteur disponible) et cadre qui défile. */
  const cadre = useRef<HTMLDivElement>(null);
  const zoneDefilement = useRef<HTMLDivElement>(null);
  /** Plein écran : bilan / avancement en surimpression (null = automatique). */
  const [bandeauOuvert, setBandeauOuvert] = useState<boolean | null>(null);
  const [cleBilanVue, setCleBilanVue] = useState('');

  const { preferences, definir: definirPreference, reinitialiser } = usePreferencesSaisie();
  const saisie = useSaisieJournee({ date, champ: 'quantiteRestante' });
  const trajet = useParcours(date);

  const enRecherche = recherche.trim().length > 0;
  const modeFocus = preferences.mode === 'focus';
  const [pleinEcran, definirPleinEcran] = usePleinEcranComptage(!modeFocus);
  // Plein écran : le pavé reste ouvert (jamais le clavier système, qui couvrirait la grille).
  const modePave = preferences.clavier === 'pave' || pleinEcran;
  /** Plein écran : zone de la grille, mesurée pour que toute la page y tienne. */
  const [zoneGrille, tailleZone] = useTailleZone(pleinEcran);

  const idParcoursUtilise = parcoursActif ?? trajet.idParDefaut;
  const parcoursUtilise = trajet.parcours.find((p) => p.id === idParcoursUtilise) ?? null;

  // Le parcours par défaut s'applique au premier chargement, sans écraser un
  // choix fait à la main pendant la session.
  // (Ajustement pendant le rendu, motif recommandé par React, plutôt qu'un effet.)
  if (!triImpose && trajet.pret) {
    setTriImpose(true);
    if (trajet.idParDefaut && preferences.tri === 'feuille') definirPreference('tri', 'parcours');
  }

  /**
   * Toute saisie passe par ici : en plus d'enregistrer la valeur, on note le
   * passage du vendeur devant le produit. C'est ce qui construit le trajet
   * sans lui demander d'activer quoi que ce soit.
   */
  const compter = useCallback(
    (produitId: number, valeur: string) => {
      // Premier geste de l'inventaire du jour : heure comparée à la fermeture
      // (donnée en base, sinon hypothèse). Avertissement seulement.
      if (debutControle?.date !== date && date === dateDuJour()) {
        setDebutControle({ date, signalements: controleDebutInventaire(new Date(), saisie.heureFermeture) });
      }
      saisie.definir(produitId, valeur);
      if (valeur === '') trajet.oublierPassage(produitId);
      else trajet.noterPassage(produitId);
    },
    [saisie, trajet, date, debutControle]
  );

  const changerDate = (suivante: string) => {
    setDate(suivante);
    setRecomptage(null);
    setAvertissementsLocaux(new Map());
    setPanneauFin(false);
  };

  const ouvrirOuFermerRecherche = (texte: string) => {
    // À l'ouverture de la recherche, on fige la liste des produits déjà
    // comptés : en retrouver un, c'est le recompter (addition, R21).
    if (recherche.trim() === '' && texte.trim() !== '') {
      setComptesALaRecherche(
        new Set(saisie.produits.filter((p) => (saisie.valeurs[p.id] ?? '') !== '').map((p) => p.id))
      );
    }
    setRecherche(texte);
  };

  /* ------------------------------------------------------- Ordre d'affichage */

  // Instantané des valeurs utilisé pour classer : pris à la fin d'un
  // chargement et à chaque reclassement demandé, jamais pendant la frappe.
  const [valeursPourTri, setValeursPourTri] = useState(saisie.valeurs);
  const [chargementVu, setChargementVu] = useState(saisie.chargement);
  if (chargementVu !== saisie.chargement) {
    setChargementVu(saisie.chargement);
    if (!saisie.chargement) setValeursPourTri(saisie.valeurs);
  }
  const reclasser = () => setValeursPourTri(saisie.valeurs);

  /**
   * L'ordre est FIGÉ entre deux recalculs.
   *
   * Classer « à compter d'abord » sur les valeurs en direct ferait descendre
   * le produit à l'instant où on tape son premier chiffre : la ligne s'en va
   * sous le doigt avant qu'on ait fini de saisir. L'ordre n'est donc recalculé
   * qu'à des moments choisis — changement de page, de journée, de tri, ou
   * demande explicite — jamais pendant la frappe.
   */
  const produitsOrdonnes = useMemo(() => {
    const valeurs = valeursPourTri;
    let liste = saisie.produits;

    if (preferences.tri === 'parcours') {
      const reference = parcoursUtilise?.produitIds ?? [];
      if (reference.length > 0) liste = classerSelonParcours(liste, reference);
    } else if (preferences.tri === 'restants') {
      liste = [...liste].sort((a, b) => {
        const aFait = (valeurs[a.id] ?? '') !== '' ? 1 : 0;
        const bFait = (valeurs[b.id] ?? '') !== '' ? 1 : 0;
        return aFait - bFait || a.ordre - b.ordre;
      });
    }

    return liste;
  }, [saisie.produits, preferences.tri, parcoursUtilise, valeursPourTri]);

  /* ----------------------------------------------------------------- Sections */

  /** Pages (ou zones) hors recherche : elles servent aussi à retrouver un produit. */
  const sectionsNormales = useMemo<Section[]>(() => {
    if (modeFocus) {
      return [{ cle: 'tout', libelle: 'Tous les produits', produits: produitsOrdonnes }];
    }

    if (preferences.decoupage === 'zones') {
      const groupes = new Map<string, Produit[]>();
      for (const produit of produitsOrdonnes) {
        const liste = groupes.get(produit.categorie) ?? [];
        liste.push(produit);
        groupes.set(produit.categorie, liste);
      }
      return trierCategories([...groupes.keys()]).map((categorie) => ({
        cle: categorie,
        libelle: categorie,
        produits: groupes.get(categorie) ?? [],
      }));
    }

    // Pages d'une vingtaine de produits dans l'ordre affiché, calées sur les
    // changements de rayon : le parcours n'est pas brisé, et une page ne se
    // termine plus sur trois baguettes avant d'enchaîner sur les salades.
    return decouperEnPages(produitsOrdonnes).map((produits, index) => ({
      cle: `page-${index}-${produits[0]?.id ?? 0}`,
      libelle: String(index + 1),
      produits,
    }));
  }, [produitsOrdonnes, preferences.decoupage, modeFocus]);

  // Plein écran : une page qui ne tient pas, même au plus serré, est découpée
  // en sous-pages plutôt que de défiler. La grille a un cadre de 1 px.
  const largeurGrille = tailleZone ? tailleZone.largeur - 2 : 0;
  const hauteurGrille = tailleZone ? tailleZone.hauteur - 2 : 0;
  const scinder = useCallback(
    (liste: Section[]): Section[] => {
      if (hauteurGrille <= 0 || largeurGrille <= 0) return liste;
      return liste.flatMap((section) => {
        const { sousPages } = calculerDisposition(
          section.produits.length,
          largeurGrille,
          hauteurGrille,
          section.produits.map((p) => ({ nom: p.nom, unite: p.unite }))
        );
        if (sousPages <= 1) return [section];
        const tranches = scinderEnSousPages(section.produits, sousPages);
        return tranches.map((produits, index) => ({
          cle: `${section.cle}-${index}`,
          libelle: section.libelle,
          produits,
          sousPage: { index, total: tranches.length },
        }));
      });
    },
    [largeurGrille, hauteurGrille]
  );
  const sectionsAffichees = useMemo(() => scinder(sectionsNormales), [scinder, sectionsNormales]);

  const sections = useMemo<Section[]>(() => {
    if (!enRecherche) return sectionsAffichees;
    const terme = recherche.trim().toLowerCase();
    return scinder([
      {
        cle: 'recherche',
        libelle: `Résultats pour « ${recherche.trim()} »`,
        produits: produitsOrdonnes.filter((p) => p.nom.toLowerCase().includes(terme)),
      },
    ]);
  }, [enRecherche, recherche, produitsOrdonnes, sectionsAffichees, scinder]);

  /** Ordre de passage complet (toutes pages), pour « prochain non compté ». */
  const ordrePassage = useMemo(
    () => sectionsNormales.flatMap((s) => s.produits.map((p) => p.id)),
    [sectionsNormales]
  );

  // L'index reste dans les bornes quand le découpage ou la recherche changent.
  const indexBorne = Math.min(indexSection, Math.max(0, sections.length - 1));
  const sectionCourante = sections[indexBorne] ?? null;
  const produitsVisibles = useMemo(
    () => (modeFocus ? produitsOrdonnes : (sectionCourante?.produits ?? [])),
    [modeFocus, produitsOrdonnes, sectionCourante]
  );

  const avancementSection = useCallback(
    (produits: Produit[]) => {
      const faits = produits.filter((p) => (saisie.valeurs[p.id] ?? '') !== '').length;
      return { faits, total: produits.length };
    },
    [saisie.valeurs]
  );

  /* ------------------------------------------------------------- Navigation */

  // En mode « un par un » ou pavé, un produit est toujours sélectionné : le
  // premier de la page si la sélection n'y est plus.
  const selectionEffective =
    (modeFocus || modePave) && !produitsVisibles.some((p) => p.id === selectionne)
      ? (produitsVisibles[0]?.id ?? null)
      : selectionne;
  const indexSelectionne = produitsVisibles.findIndex((p) => p.id === selectionEffective);
  const produitSelectionne = indexSelectionne >= 0 ? produitsVisibles[indexSelectionne] : null;

  const allerAuProduit = useCallback(
    (decalage: number) => {
      if (produitsVisibles.length === 0) return;
      const depart = indexSelectionne < 0 ? 0 : indexSelectionne;
      const cible = Math.min(Math.max(depart + decalage, 0), produitsVisibles.length - 1);
      const suivant = produitsVisibles[cible];
      setSelectionne(suivant.id);
      // Sans pavé pour le suivant (clavier du téléphone, produit à la pièce) :
      // le curseur passe dans son champ, prêt pour la saisie suivante.
      if (!modePave && !modeFocus && suivant.unite !== 'kg') {
        requestAnimationFrame(() => focaliserLigne(suivant.id));
      }
    },
    [produitsVisibles, indexSelectionne, modePave, modeFocus]
  );

  /** « Entrée » dans le champ d'une ligne (clavier, lecteur) : produit suivant. */
  const entreeSurLigne = (produitId: number) => {
    const index = produitsVisibles.findIndex((p) => p.id === produitId);
    const suivant = index >= 0 ? produitsVisibles[index + 1] : undefined;
    if (!suivant) return;
    setSelectionne(suivant.id);
    if (suivant.unite === 'kg') return; // le pavé décimal s'ouvre (LOI 2)
    requestAnimationFrame(() => focaliserLigne(suivant.id));
  };

  const allerALaSection = (index: number, produitASelectionner?: number) => {
    if (index < 0 || index >= sections.length) return;
    setIndexSection(index);
    if (produitASelectionner !== undefined) setSelectionne(produitASelectionner);
    // Le changement de page est le bon moment pour reclasser : rien n'est en
    // cours de frappe, et le vendeur s'attend à voir la suite de son travail.
    reclasser();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    zoneDefilement.current?.scrollTo({ top: 0 });
  };

  /**
   * Va à un produit précis, sur n'importe quelle page : ferme la recherche si
   * besoin, ouvre la bonne page, le sélectionne et l'amène en vue. L'ordre
   * n'est pas reclassé (le produit ne bouge pas sous le doigt).
   */
  const allerA = (produitId: number) => {
    setPanneauFin(false);
    setBandeauOuvert(false);
    setRecomptage(null);
    if (enRecherche || rechercheOuverte) {
      setRecherche('');
      setRechercheOuverte(false);
    }
    const index = sectionsAffichees.findIndex((s) => s.produits.some((p) => p.id === produitId));
    if (index >= 0) setIndexSection(index);
    setSelectionne(produitId);
    const produit = saisie.produits.find((p) => p.id === produitId);
    // Avec pavé (mode pavé, ou produit au kilo — LOI 2), `useLigneActiveEnVue` amène la ligne.
    if (modeFocus || modePave || produit?.unite === 'kg') return;
    requestAnimationFrame(() => focaliserLigne(produitId));
  };

  /**
   * « Valider · suivant » du pavé : produit suivant de la page, et en fin de
   * page, premier produit de la page suivante.
   */
  const pageSuivante = !modeFocus && indexBorne < sections.length - 1 ? sections[indexBorne + 1] : null;
  const peutValiderSuivant = indexSelectionne < produitsVisibles.length - 1 || pageSuivante !== null;
  const validerEtSuivant = () => {
    if (indexSelectionne < produitsVisibles.length - 1) {
      allerAuProduit(1);
      return;
    }
    const premier = pageSuivante?.produits[0];
    if (!premier) return;
    allerALaSection(indexBorne + 1, premier.id);
    if (!modePave && premier.unite !== 'kg') requestAnimationFrame(() => focaliserLigne(premier.id));
  };

  /* ------------------------------------------------------------------ Pavé */

  const valeurSelectionnee = produitSelectionne ? (saisie.valeurs[produitSelectionne.id] ?? '') : '';
  const selectionAuPoids = produitSelectionne?.unite === 'kg';

  /** Texte affiché d'une quantité : grammes → « 1,250 kg » (LOI 2). */
  const afficherQuantite = (produit: Produit, valeur: string) =>
    produit.unite === 'kg' && valeur !== '' ? formaterQuantite('kg', Number(valeur)) : valeur;

  const recompter = (produit: Produit, ajout: number) => {
    const deja = Number(saisie.valeurs[produit.id] ?? '0');
    const r = additionnerRecomptage(produit, deja, ajout);
    if (r.ok) compter(produit.id, String(r.donnees));
    setAvertissementsLocaux((precedent) =>
      new Map(precedent).set(produit.id, r.ok ? r.signalements : [r])
    );
    setRecomptage(null);
  };

  const fermerPave = () => {
    if (recomptage !== null) {
      setRecomptage(null);
      return;
    }
    if (modePave) definirPreference('clavier', 'natif');
    if (!modeFocus) setSelectionne(null);
  };

  /** Signalements d'une ligne : refus du serveur, contrôles du domaine, avertissements reçus. */
  const signalementsDe = (produit: Produit): SignalementLigne[] => {
    const refus = saisie.refus.get(produit.id);
    return [
      ...(refus ? [refus] : []),
      ...controlesComptage(
        produit,
        saisie.valeurs[produit.id],
        saisie.inventaires.get(produit.id)?.quantiteProduite
      ),
      ...(saisie.avertissementsServeur.get(produit.id) ?? []),
      ...(avertissementsLocaux.get(produit.id) ?? []),
    ];
  };
  /** Niveau le plus grave d'une ligne (icône de la grille plein écran). */
  const niveauDe = (produit: Produit): Niveau | undefined =>
    signalementsDe(produit).reduce<Niveau | undefined>(
      (pire, s) => (pire === undefined || GRAVITE[s.niveau] > GRAVITE[pire] ? s.niveau : pire),
      undefined
    );
  const blocSignalements = (produit: Produit) => {
    const liste = signalementsDe(produit);
    return liste.length > 0 ? (
      <SignalementsLigne signalements={liste} onEffacer={() => compter(produit.id, '')} />
    ) : undefined;
  };

  /* --------------------------------------------------------------- Affichage */

  // « On veut scroller le moins possible » : des LIGNES denses (nom et
  // quantité sur une seule ligne). En adaptatif, le nombre de colonnes suit la
  // largeur RÉELLE de la liste (requête de conteneur), pavé ouvert ou non :
  // 1 colonne au téléphone et en portrait à côté du pavé, 2 dès ~576 px,
  // 3 dès ~896 px. « Deux colonnes » imposé garde les cartes (nom au-dessus).
  const enCartes = preferences.colonnes === '2';
  const classesGrille = {
    auto: 'grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3',
    '1': 'grid-cols-1',
    '2': 'grid-cols-2',
  }[preferences.colonnes];
  const ongletsVisibles = !enRecherche && !modeFocus && sections.length > 1;
  const parPages = preferences.decoupage === 'pages';

  // Tablette : la page tient dans l'écran, seule la liste défile (null = la page défile).
  const hauteurCadre = useHauteurSansDefilementPage(cadre, !modeFocus);
  const contraint = hauteurCadre !== null;

  // Avancement sur les produits ACTIFS de la liste d'inventaire (LOI 10).
  const progression = useMemo(
    () => calculerProgression(saisie.produits, saisie.valeurs),
    [saisie.produits, saisie.valeurs]
  );
  const comptageTermine = progression.total > 0 && progression.restants.length === 0;

  // En mode « à compter d'abord », l'ordre affiché vieillit au fil de la
  // saisie. Plutôt que de le rafraîchir sous le doigt, on le propose.
  const dejaComptesDansLaPage = produitsVisibles.filter(
    (p) => (saisie.valeurs[p.id] ?? '') !== ''
  ).length;
  const triPerime =
    preferences.tri === 'restants' && !enRecherche && dejaComptesDansLaPage > 0 && !comptageTermine;
  // Le pavé s'ouvre en mode pavé, pour un produit au kilo (jamais de clavier
  // ni de « +1 » pour un poids), et pour un recomptage.
  const paveVisible =
    produitSelectionne !== null &&
    !saisie.chargement &&
    (modePave || selectionAuPoids || recomptage === produitSelectionne.id);

  // Lignes encore signalées : refus (bloquant, NON enregistrées) et avertissements.
  let premierACorriger: number | null = null;
  let premierAvertissement: number | null = null;
  let nbACorriger = 0;
  let nbAvertissements = 0;
  if (!saisie.chargement) {
    const parId = new Map(saisie.produits.map((p) => [p.id, p]));
    for (const id of ordrePassage) {
      const produit = parId.get(id);
      if (!produit) continue;
      const liste = signalementsDe(produit);
      if (liste.some((s) => s.niveau === 'bloquant')) {
        nbACorriger += 1;
        premierACorriger ??= id;
      } else if (liste.some((s) => s.niveau === 'avertissement')) {
        nbAvertissements += 1;
        premierAvertissement ??= id;
      }
    }
  }
  const termineQuandMeme = termineQuandMemeLe === date;
  const bilan = bilanFinInventaire({
    progression,
    nbEnAttente: saisie.nbEnAttente,
    envoiEnCours: saisie.statut === 'envoi',
    nbACorriger,
    nbAvertissements,
    termineQuandMeme,
  });
  const nomsParId = new Map(saisie.produits.map((p) => [p.id, p.nom]));
  const restantsSet = new Set(progression.restants);
  const manquants = ordrePassage
    .filter((id) => restantsSet.has(id))
    .map((id) => ({ id, nom: nomsParId.get(id) ?? '' }));

  const allerAuProchainNonCompte = () => {
    const id = prochainNonCompte(ordrePassage, saisie.valeurs, selectionEffective);
    if (id !== null) allerA(id);
  };

  // Inventaire terminé — compté ET enregistré, jamais avec un envoi en attente
  // ou une saisie refusée : un rappel d'équipe, une fois par journée. Il part
  // au moment où le dernier envoi est confirmé (statut « enregistré »), ou à la
  // confirmation de « Terminer quand même » ; pas au simple rechargement d'un
  // inventaire déjà fini.
  // HYPOTHÈSE À VALIDER : « Terminer quand même » ne clôt rien en base — les
  // produits manquants restent « pas compté » (jamais transformés en 0).
  const inventaireTermine =
    bilan.etat === 'termine' && (saisie.statut === 'enregistre' || termineQuandMeme);
  if (inventaireTermine && termineLe !== date) setTermineLe(date);
  // La ligne en cours de saisie n'est jamais cachée par le pavé.
  // (En plein écran, toute la page est visible : rien à faire défiler.)
  const suivreLigne = paveVisible && !modeFocus && !pleinEcran;
  useLigneActiveEnVue(suivreLigne ? selectionEffective : null, suivreLigne);

  // Plein écran : le bilan s'ouvre tout seul quand il y a quelque chose à dire
  // (terminé, envois en attente, saisie refusée) ; refermable ; rouvert par « 87/123 ».
  const cleBilan = `${date}:${bilan.etat}`;
  if (cleBilan !== cleBilanVue) {
    setCleBilanVue(cleBilan);
    setBandeauOuvert(null);
  }
  const bandeauVisible = !saisie.chargement && (bandeauOuvert ?? (bilan.etat !== 'en_cours' || panneauFin));

  // Grille plein écran de la page courante : tout tient, sans défilement.
  const disposition =
    pleinEcran && hauteurGrille > 0 && largeurGrille > 0
      ? calculerDisposition(produitsVisibles.length, largeurGrille, hauteurGrille, produitsVisibles.map((p) => ({ nom: p.nom, unite: p.unite })))
      : null;

  const avertissementDebut = debutControle?.date === date ? debutControle.signalements : [];

  const bornesSection =
    sectionCourante && sectionCourante.produits.length > 0
      ? `${sectionCourante.produits[0].nom} → ${sectionCourante.produits[sectionCourante.produits.length - 1].nom}`
      : null;

  const pave =
    paveVisible && produitSelectionne ? (
      <PaveSaisieProduit
        key={`${produitSelectionne.id}-${recomptage === produitSelectionne.id ? 'ajout' : 'saisie'}`}
        produit={produitSelectionne}
        valeur={valeurSelectionnee}
        onChange={(v) => compter(produitSelectionne.id, v)}
        onAjouter={
          recomptage === produitSelectionne.id ? (n) => recompter(produitSelectionne, n) : undefined
        }
        sousTitre={
          recomptage === produitSelectionne.id
            ? `Déjà compté : ${afficherQuantite(produitSelectionne, valeurSelectionnee)}${
                selectionAuPoids ? '' : ' pièce(s)'
              }. Saisissez ce que vous ajoutez.`
            : undefined
        }
        onSuivant={validerEtSuivant}
        peutAllerSuivant={peutValiderSuivant}
        // Plein écran : le pavé reste ouvert ; « Fermer » n'annule qu'un recomptage.
        onFermer={pleinEcran && recomptage !== produitSelectionne.id ? undefined : fermerPave}
      />
    ) : null;


  /* Blocs communs aux deux présentations (normale et plein écran). */
  const blocAvertissementDebut = avertissementDebut.map((s) => (
    <Signalement
      key={s.code}
      signalement={s}
      className="sans-impression mb-2 shrink-0"
      autreSortie={
        <button
          type="button"
          onClick={() => setDebutControle({ date, signalements: [] })}
          className="min-h-11 rounded-lg border border-line-fort bg-surface px-3 text-sm font-medium text-ink"
        >
          Compris
        </button>
      }
    />
  ));

  const boutonChercher = rechercheOuverte ? null : (
    <button
      type="button"
      onClick={() => setRechercheOuverte(true)}
      aria-label="Chercher un produit"
      className="sans-impression flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm text-ink-2 hover:border-line-fort hover:text-ink"
    >
      Chercher
    </button>
  );

  const bandeauProgression = (avant: ReactNode) =>
    saisie.chargement ? null : (
      <BandeauProgression
        progression={progression}
        bilan={bilan}
        manquants={manquants}
        panneauOuvert={panneauFin}
        onOuvrirPanneau={setPanneauFin}
        onConfirmerTerminer={() => {
          setTermineQuandMemeLe(date);
          setPanneauFin(false);
        }}
        onProchain={allerAuProchainNonCompte}
        onAllerA={allerA}
        premierAvertissement={premierAvertissement}
        premierACorriger={premierACorriger}
        onEnvoyer={() => void saisie.enregistrerMaintenant()}
        envoiEnCours={saisie.statut === 'envoi'}
        horsLigne={saisie.statut === 'hors-ligne'}
        avant={avant}
        apres={
          <IndicateurSauvegarde
            statut={saisie.statut}
            derniereSauvegarde={saisie.derniereSauvegarde}
            nbEnAttente={saisie.nbEnAttente}
            messageErreur={saisie.messageErreur}
            onReessayer={() => void saisie.enregistrerMaintenant()}
          />
        }
        rappel={
          // LOI 11 : rappel d'équipe juste sous l'état de fin, là où l'œil est.
          <RappelApresAction
            moment="apres_inventaire"
            declencheur={termineLe === date ? date : null}
            className="sans-impression mt-2"
          />
        }
      />
    );

  // La recherche réordonne toute la liste : elle reste repliée tant qu'on
  // ne la demande pas, pour ne pas casser l'ordre pendant un comptage.
  const champRecherche = (classes: string) => (
    <div className={classes}>
      <input
        type="search"
        value={recherche}
        onChange={(e) => ouvrirOuFermerRecherche(e.target.value)}
        placeholder="Chercher un produit dans toute la liste…"
        aria-label="Chercher un produit"
        autoFocus
        className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
      />
      <Bouton
        variante="secondaire"
        onClick={() => {
          setRecherche('');
          setRecomptage(null);
          setRechercheOuverte(false);
        }}
      >
        Fermer
      </Bouton>
    </div>
  );

  /** Onglets de pages (ou de zones), sous-pages comprises (« Page 1 · 1/2 »). */
  const ongletsPages = (
    <BandeauOnglets ariaLabel={parPages ? 'Pages' : 'Zones du magasin'}>
      {sections.map((section, index) => {
        const { faits, total } = avancementSection(section.produits);
        const base = parPages ? `Page ${section.libelle}` : section.libelle;
        return (
          <Onglet
            key={section.cle}
            libelle={section.sousPage ? libelleSousPage(base, section.sousPage.index, section.sousPage.total) : base}
            detail={`${faits}/${total}`}
            actif={index === indexBorne}
            etat={faits === total && total > 0 ? 'complet' : faits > 0 ? 'partiel' : 'vide'}
            onClick={() => allerALaSection(index)}
          />
        );
      })}
    </BandeauOnglets>
  );

  const alerteChargement = saisie.erreurChargement ? (
    <div className="mb-2 shrink-0">
      <Alerte>
        {saisie.erreurChargement}{' '}
        <button onClick={() => void saisie.recharger()} className="underline underline-offset-2">
          Recharger
        </button>
      </Alerte>
    </div>
  ) : null;

  /* ------------------------------------------------------- Plein écran */

  // Il ne reste que : onglets de pages (une ligne), avancement réduit, loupe,
  // sortie du mode ; la grille de la page ; le pavé (à côté). Le reste est
  // en surimpression, seulement quand il y a quelque chose à dire.
  /** « P2 Viennoiserie » (ou « P1 · 1/2 Boulangerie ») : numéro et rayon(s) de la page. */
  const libelleCourtPage = (section: Section) => {
    const base = parPages ? `P${section.libelle}` : section.libelle;
    const numero = section.sousPage ? libelleSousPage(base, section.sousPage.index, section.sousPage.total) : base;
    return parPages ? `${numero} ${libellePage(section.produits)}` : numero;
  };

  /** Va à une page et sélectionne son premier produit NON compté (sinon le premier). */
  const changerDePage = (index: number) => {
    const cible = sections[index];
    if (!cible) return;
    const premier = cible.produits.find((p) => (saisie.valeurs[p.id] ?? '') === '') ?? cible.produits[0];
    allerALaSection(index, premier?.id);
  };

  /** Plein écran : onglets compacts (« P1 17/17 »), sur plusieurs lignes si besoin — tous visibles. */
  const ongletsCompacts = (
    <div role="tablist" aria-label={parPages ? 'Pages' : 'Zones du magasin'} className="flex flex-wrap gap-1.5">
      {sections.map((section, index) => {
        const { faits, total } = avancementSection(section.produits);
        const base = parPages ? `P${section.libelle}` : section.libelle;
        return (
          <Onglet
            key={section.cle}
            libelle={section.sousPage ? libelleSousPage(base, section.sousPage.index, section.sousPage.total) : base}
            detail={`${faits}/${total}`}
            actif={index === indexBorne}
            etat={faits === total && total > 0 ? 'complet' : faits > 0 ? 'partiel' : 'vide'}
            onClick={() => changerDePage(index)}
          />
        );
      })}
    </div>
  );

  /** Plein écran, colonne du pavé : avancement, loupe, sortie — puis le pavé, puis le bilan. */
  const colonnePave = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {saisie.chargement ? (
          <span className="flex-1" />
        ) : (
          <button
            type="button"
            onClick={() => setBandeauOuvert(!bandeauVisible)}
            aria-expanded={bandeauVisible}
            aria-label={`${progression.comptes} produits comptés sur ${progression.total} — voir l’avancement`}
            className="flex h-11 min-w-0 flex-1 flex-col items-stretch justify-center gap-1 rounded-lg px-2 text-left hover:bg-surface-2"
          >
            <span className="chiffres text-sm text-ink">
              <span className="font-semibold">{progression.comptes}</span>/{progression.total} comptés
            </span>
            <span className="block h-1 w-full overflow-hidden rounded-full bg-line">
              <span
                className={`block h-full rounded-full ${comptageTermine ? 'bg-ok' : 'bg-accent'}`}
                style={{ width: `${progression.pourcent}%` }}
              />
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setRechercheOuverte(true)}
          aria-label="Chercher un produit"
          title="Chercher un produit"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 hover:border-line-fort hover:text-ink"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => definirPleinEcran(false)}
          aria-label="Quitter le plein écran"
          title="Quitter le plein écran"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 hover:border-line-fort hover:text-ink"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
          </svg>
        </button>
      </div>

      {pave}

      {/* Changer de page sans quitter le pavé des yeux. */}
      {!enRecherche && sections.length > 1 ? (
        <div className="grid grid-cols-2 gap-2">
          {[
            { index: indexBorne - 1, sens: 'Page précédente', fleche: '‹' },
            { index: indexBorne + 1, sens: 'Page suivante', fleche: '›' },
          ].map(({ index, sens, fleche }) => {
            const cible = sections[index];
            const precedente = fleche === '‹';
            return (
              <button
                key={sens}
                type="button"
                onClick={() => changerDePage(index)}
                disabled={!cible}
                className={`flex min-h-14 flex-col justify-center rounded-xl border-2 border-line-fort bg-surface px-2 py-1 text-ink hover:bg-surface-2 active:bg-surface-2 disabled:border-line disabled:text-ink-3 disabled:opacity-50 ${
                  precedente ? 'items-start text-left' : 'items-end text-right'
                }`}
              >
                <span className="text-xs text-ink-2">{sens}</span>
                <span className="text-sm font-semibold leading-tight">
                  {precedente ? `${fleche} ` : ''}
                  {cible ? libelleCourtPage(cible) : '—'}
                  {precedente ? '' : ` ${fleche}`}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Bilan et avertissement LOI 11 SOUS le pavé : rien de la grille n'est caché. */}
      {blocAvertissementDebut.length > 0 || bandeauVisible ? (
        <div className="rounded-xl border border-line-fort bg-surface p-2">
          {blocAvertissementDebut}
          {bandeauVisible ? (
            <>
              {bandeauProgression(null)}
              <div className="flex justify-end">
                <Bouton variante="secondaire" onClick={() => setBandeauOuvert(false)} className="shrink-0">
                  Masquer
                </Bouton>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const contenuPleinEcran = (
    <>
      <div className="relative mb-2 min-h-11 shrink-0">
        {enRecherche ? (
          <p className="flex min-h-11 items-center truncate text-sm font-semibold text-ink">{sectionCourante?.libelle}</p>
        ) : sections.length > 1 ? (
          ongletsCompacts
        ) : sectionCourante ? (
          <p className="flex min-h-11 items-center truncate text-sm font-semibold text-ink">
            {parPages ? `Page ${sectionCourante.libelle}` : sectionCourante.libelle}
          </p>
        ) : null}

        {/* Loupe : le champ s'ouvre PAR-DESSUS la ligne d'onglets. */}
        {rechercheOuverte ? champRecherche('sans-impression absolute inset-x-0 top-0 z-40 flex min-h-11 items-center gap-2 bg-ground') : null}
      </div>

      {alerteChargement}

      {/* Zone de la grille : mesurée, tous les produits de la page y tiennent. */}
      <div ref={zoneGrille} className="relative min-h-0 flex-1">
        {saisie.chargement ? (
          <Chargement libelle="Chargement de la liste d'inventaire…" />
        ) : produitsVisibles.length === 0 ? (
          <Carte>
            <EtatVide
              titre={enRecherche ? 'Aucun produit ne correspond' : 'Aucun produit à compter'}
              detail={enRecherche ? 'Essayez un autre mot.' : undefined}
            />
          </Carte>
        ) : disposition ? (
          <div
            className="grid gap-x-2 rounded-xl border border-line bg-surface"
            style={{
              gridTemplateColumns: `repeat(${disposition.colonnes}, minmax(0, 1fr))`,
              gridAutoRows: `${disposition.hauteurLigne}px`,
            }}
          >
            {produitsVisibles.map((produit, index) => {
              const recomptable =
                enRecherche && comptesALaRecherche.has(produit.id) && (saisie.valeurs[produit.id] ?? '') !== '';
              const rangee = Math.floor(index / disposition.colonnes);
              return (
                <LigneSaisie
                  key={produit.id}
                  produitId={produit.id}
                  nom={produit.nom}
                  unite={produit.unite}
                  valeur={saisie.valeurs[produit.id] ?? ''}
                  onChange={(v) => compter(produit.id, v)}
                  main={preferences.main}
                  modePave
                  selectionne={paveVisible && produit.id === selectionEffective}
                  onSelectionner={() => {
                    setSelectionne(produit.id);
                    setRecomptage(recomptable ? produit.id : null);
                  }}
                  hauteurFixe={disposition.hauteurLigne}
                  niveauSignalement={niveauDe(produit)}
                  surimpressionVers={rangee >= disposition.rangees / 2 ? 'haut' : 'bas'}
                  signalements={blocSignalements(produit)}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <div>
      {pleinEcran ? null : (
        <Entete
          titre="Comptage du restant"
          sousTitre={
            <>
              Ce qu&apos;il reste en rayon le{' '}
              <span className="font-medium capitalize text-ink">{formatDateLong(date)}</span>
            </>
          }
          actions={
            <>
              <BasculeCotePave className="sans-impression min-h-11 px-2.5 text-xs" />
              <ReglagesSaisie
                preferences={preferences}
                onChanger={definirPreference}
                onReinitialiser={reinitialiser}
              />
              <SelecteurJournee date={date} onChange={changerDate} libelle="Journée" />
              {/* Tablette seulement : retour au plein écran (choix mémorisé sur l'appareil). */}
              {modeFocus ? null : (
                <button
                  type="button"
                  onClick={() => definirPleinEcran(true)}
                  className="sans-impression hidden min-h-11 items-center rounded-lg border border-line bg-surface px-2.5 text-xs text-ink-2 hover:border-line-fort hover:text-ink sm:inline-flex"
                >
                  Plein écran
                </button>
            )}
          </>
        }
      />
      )}

      <DispositionAvecPave pave={pleinEcran ? colonnePave : pave}>
        {/* Tablette : hauteur de l'écran, la page ne défile pas ; la liste défile dans son cadre. */}
        <div
          ref={cadre}
          className={contraint || pleinEcran ? 'flex flex-col' : undefined}
          style={
            pleinEcran
              ? // Plein écran : rien au-dessus, marges de <main> 0,5 rem (globals.css) — pur CSS, suit la rotation.
                { height: 'calc(100dvh - 1rem)' }
              : contraint
                ? { height: hauteurCadre }
                : undefined
          }
        >
          {pleinEcran ? contenuPleinEcran : (
          <>
          {blocAvertissementDebut}

          {bandeauProgression(boutonChercher)}

          {rechercheOuverte ? champRecherche('sans-impression mb-2 flex shrink-0 gap-2') : null}

          {ongletsVisibles ? <div className="mb-2 shrink-0">{ongletsPages}</div> : null}

          {alerteChargement}

          {/* Zone qui défile. Les lignes s'arrêtent sous l'en-tête collant de la liste. */}
          <div
            ref={zoneDefilement}
            data-defilement-liste
            className={
              contraint
                ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl [&_[data-ligne-produit]]:scroll-mt-11'
                : undefined
            }
          >
            {saisie.chargement ? (
              <>
                <Chargement libelle="Chargement de la liste d'inventaire…" />
                <RappelChargement className="mx-auto max-w-md" />
              </>
            ) : produitsVisibles.length === 0 ? (
              <Carte>
                <EtatVide
                  titre={enRecherche ? 'Aucun produit ne correspond' : 'Aucun produit à compter'}
                  detail={enRecherche ? 'Essayez un autre mot.' : undefined}
                />
              </Carte>
            ) : modeFocus && produitSelectionne ? (
              /* -------------------------------------------------- Mode un par un */
              <Carte className="px-5 py-8 text-center">
                <div className="chiffres text-xs uppercase tracking-wide text-ink-3">
                  {indexSelectionne + 1} sur {produitsVisibles.length} · {produitSelectionne.categorie}
                </div>

                <h2 className="mx-auto mt-3 max-w-sm text-2xl font-semibold text-ink text-balance">
                  {produitSelectionne.nom}
                </h2>

                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => compter(produitSelectionne.id, valeurSelectionnee === '0' ? '' : '0')}
                    aria-pressed={valeurSelectionnee === '0'}
                    className={`h-14 w-14 rounded-xl border text-base font-medium ${
                      valeurSelectionnee === '0'
                        ? 'border-accent bg-accent-doux text-accent'
                        : 'border-line text-ink-3'
                    }`}
                  >
                    0
                  </button>

                  <input
                    type="text"
                    inputMode={modePave || selectionAuPoids ? 'none' : 'numeric'}
                    pattern={selectionAuPoids ? undefined : '[0-9]*'}
                    readOnly={modePave || selectionAuPoids}
                    value={afficherQuantite(produitSelectionne, valeurSelectionnee)}
                    onChange={(e) => compter(produitSelectionne.id, e.target.value)}
                    onFocus={(e) =>
                      modePave || selectionAuPoids ? e.currentTarget.blur() : e.currentTarget.select()
                    }
                    placeholder={selectionAuPoids ? '— kg' : '—'}
                    aria-label={selectionAuPoids ? `${produitSelectionne.nom}, poids en kg` : produitSelectionne.nom}
                    autoFocus={!modePave && !selectionAuPoids}
                    className="chiffres h-20 w-36 rounded-xl border border-line-fort bg-surface text-center text-4xl font-semibold text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
                  />
                </div>

                <p className="mt-3 text-xs text-ink-3">
                  {valeurSelectionnee === '' ? 'pas encore compté' : selectionAuPoids ? 'poids restant' : 'quantité restante'}
                </p>

                {blocSignalements(produitSelectionne) ? (
                  <div className="mx-auto mt-4 max-w-md text-left">{blocSignalements(produitSelectionne)}</div>
                ) : null}

                <div className="mt-8 flex items-center justify-center gap-2">
                  <Bouton
                    variante="secondaire"
                    onClick={() => allerAuProduit(-1)}
                    disabled={indexSelectionne <= 0}
                  >
                    ‹ Précédent
                  </Bouton>
                  <Bouton
                    variante="principal"
                    onClick={() => allerAuProduit(1)}
                    disabled={indexSelectionne >= produitsVisibles.length - 1}
                  >
                    Suivant ›
                  </Bouton>
                </div>
              </Carte>
            ) : (
              /* ------------------------------------------------------ Mode liste */
              <Carte className="@container">
                <div
                  className={`flex items-center justify-between gap-3 border-b border-line px-3 py-2 ${
                    contraint ? 'sticky top-0 z-10 rounded-t-xl bg-surface' : ''
                  }`}
                >
                  <h2 className="min-w-0 truncate text-sm font-semibold text-ink">
                    {enRecherche
                      ? sectionCourante?.libelle
                      : parPages && sectionCourante
                        ? `Page ${sectionCourante.libelle} sur ${sections.length} · ${libellePage(sectionCourante.produits)}`
                        : sectionCourante?.libelle}
                    {bornesSection && !enRecherche ? (
                      <span className="ml-2 font-normal text-ink-3">{bornesSection}</span>
                    ) : null}
                  </h2>
                  <span className="chiffres shrink-0 text-xs text-ink-3">
                    {produitsVisibles.length} produits
                  </span>
                </div>

                <div
                  className={`grid ${classesGrille} ${
                    enCartes
                      ? preferences.densite === 'compact'
                        ? 'gap-1.5 p-2'
                        : 'gap-2 p-3'
                      : 'gap-x-4 [&>*]:border-b [&>*]:border-line'
                  }`}
                >
                  {produitsVisibles.map((produit) => {
                    // Retrouvé par la recherche alors qu'il était déjà compté : recomptage (addition).
                    const recomptable =
                      enRecherche &&
                      comptesALaRecherche.has(produit.id) &&
                      (saisie.valeurs[produit.id] ?? '') !== '';
                    return (
                      <LigneSaisie
                        key={produit.id}
                        produitId={produit.id}
                        onEntree={() => entreeSurLigne(produit.id)}
                        nom={produit.nom}
                        unite={produit.unite}
                        valeur={saisie.valeurs[produit.id] ?? ''}
                        onChange={(v) => compter(produit.id, v)}
                        indice={
                          recomptable ? 'déjà compté — touchez pour ajouter' : enRecherche ? produit.categorie : undefined
                        }
                        densite={preferences.densite}
                        main={preferences.main}
                        modePave={modePave || recomptable}
                        selectionne={paveVisible && produit.id === selectionEffective}
                        onSelectionner={() => {
                          setSelectionne(produit.id);
                          setRecomptage(recomptable ? produit.id : null);
                        }}
                        variante={enCartes ? 'carte' : 'ligne'}
                        signalements={blocSignalements(produit)}
                      />
                    );
                  })}
                </div>
              </Carte>
            )}

            {ongletsVisibles ? (
              <div
                className={`sans-impression mt-3 flex items-center justify-between gap-3 ${
                  preferences.main === 'gauche' ? 'flex-row-reverse' : ''
                }`}
              >
                <Bouton
                  variante="secondaire"
                  onClick={() => allerALaSection(indexBorne - 1)}
                  disabled={indexBorne <= 0}
                >
                  ‹ Précédent
                </Bouton>
                <span className="chiffres text-xs text-ink-3">
                  {parPages ? 'page' : 'zone'} {indexBorne + 1} sur {sections.length}
                </span>
                <Bouton
                  variante="principal"
                  onClick={() => allerALaSection(indexBorne + 1)}
                  disabled={indexBorne >= sections.length - 1}
                >
                  Suivant ›
                </Bouton>
              </div>
            ) : null}

            {triPerime ? (
              <div className="sans-impression mt-3 flex justify-center">
                <Bouton variante="secondaire" onClick={reclasser}>
                  Reclasser — {dejaComptesDansLaPage} produit
                  {dejaComptesDansLaPage > 1 ? 's' : ''} de cette page {dejaComptesDansLaPage > 1 ? 'sont comptés' : 'est compté'}
                </Bouton>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
              <Bouton
                variante="principal"
                onClick={() => void saisie.enregistrerMaintenant()}
                disabled={saisie.nbEnAttente === 0 || saisie.statut === 'envoi'}
              >
                {saisie.statut === 'envoi' ? 'Enregistrement…' : 'Enregistrer maintenant'}
              </Bouton>
            </div>

            <GestionParcours
              ordreEnCours={trajet.ordreEnCours}
              parcours={trajet.parcours}
              idParDefaut={trajet.idParDefaut}
              nombreProduits={saisie.produits.length}
              onEnregistrer={(nom) => {
                const cree = trajet.enregistrer(nom, trajet.ordreEnCours);
                setParcoursActif(cree.id);
                definirPreference('tri', 'parcours');
              }}
              onRemplacer={(id) => trajet.remplacer(id, trajet.ordreEnCours)}
              onSupprimer={trajet.supprimer}
              onDefinirParDefaut={trajet.definirParDefaut}
              onReinitialiserOrdre={trajet.reinitialiserOrdre}
              onAppliquer={(id) => {
                setParcoursActif(id);
                definirPreference('tri', 'parcours');
              }}
            />

            <RappelsService comptageTermine={comptageTermine} />
          </div>
          </>
          )}
        </div>
      </DispositionAvecPave>
    </div>
  );
}
