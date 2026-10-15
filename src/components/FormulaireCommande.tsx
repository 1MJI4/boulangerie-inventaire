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
// → produits par régime (B salé, C gâteaux, A comptoir — jamais mélangés) →
// précisions → total, acompte → valider. Chaque refus s'affiche à la saisie
// de la ligne, avec le bouton qui corrige en un geste (LOI 7 et 8).
// Tous les chiffres se tapent au pavé de l'application (R37).

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Bouton, Carte, Chargement, Entete } from '@/components/ui';
import { useEquipe } from '@/lib/vendeurs';
import type { Commande, ModePaiement, Origine } from '@/lib/commandes';
import type { OptionsGateau } from '@/lib/gateaux';
import { dateDuJour } from '@/lib/dateProduction';
import { PaveDecimalPoids, PaveEntier, PaveMontant, PaveTelephone, SelecteurDateRetrait } from '@/components/saisie';
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
import { JOURS_AVANT_ARCHIVAGE } from '@/domaine/constantes';
import type { Echec, Resultat } from '@/domaine/resultat';
import type { Deverrouillage, FicheTarifee, RegimePrix } from '@/domaine/types';
import {
  ENTREES,
  champLocal,
  echecReseau,
  estLigneAncienTarif,
  ficheDe,
  lignesIdentiques,
  refusAncienTarif,
  indexLigne,
  ligneVide,
  lireReponse,
  nouvelleCle,
  resoudreLocal,
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

const CHAMP_TEXTE =
  'min-h-12 w-full rounded-xl border-2 border-line-fort bg-surface px-3 text-base text-ink placeholder:text-ink-3';
const TITRE = 'mb-3 text-base font-semibold text-ink';

/** « Crème fraîche » se cherche en tapant « creme ». */
function normaliser(valeur: string): string {
  return valeur.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

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
  return `${l.quantite} ${unite} × ${pu} = ${total}`;
}

type DemandeGerant = { raison: string; appliquer: (d: Deverrouillage) => void };
type Validee = { id: number; numero: string; controlee: CommandeControlee | null };

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
  const [accordLendemain, setAccordLendemain] = useState<Deverrouillage | null>(() =>
    commande?.accordLendemainPar && commande.accordLendemainLe
      ? { par: commande.accordLendemainPar, le: commande.accordLendemainLe }
      : null,
  );
  const [texteGateau, setTexteGateau] = useState(commande?.texteGateau ?? '');
  const [sansEcriture, setSansEcriture] = useState(commande?.sansEcriture ?? false);
  const [photoWhatsapp, setPhotoWhatsapp] = useState(commande?.photoWhatsapp ?? false);
  const [photoImprimee, setPhotoImprimee] = useState(commande?.photoImprimee ?? false);
  const [demandeInhabituelle, setDemandeInhabituelle] = useState(commande?.demandeInhabituelle ?? false);
  const [remarques, setRemarques] = useState(commande?.remarques ?? '');

  // --- Interface -----------------------------------------------------------
  const [actif, setActif] = useState<string | null>(null);
  const [entree, setEntree] = useState<RegimePrix | 'libre'>('B');
  const [recherche, setRecherche] = useState('');
  const [tentative, setTentative] = useState(false);
  const [refusServeur, setRefusServeur] = useState<Echec | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [validee, setValidee] = useState<Validee | null>(null);
  const [demande, setDemande] = useState<DemandeGerant | null>(null);
  const [parGerant, setParGerant] = useState<string | null>(null);
  const champClient = useRef<HTMLInputElement>(null);
  const zoneProduits = useRef<HTMLDivElement>(null);

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
  const etat: EtatFormulaire = {
    client,
    telephone,
    dateRetrait,
    heureRetrait,
    lignes,
    acompteCentimes: acompte,
    totalConvenuCentimes: totalConvenu,
    remise,
    accordLendemain,
    texteGateau,
    sansEcriture,
    demandeInhabituelle,
  };

  const ctx: ContexteCommande | null = useMemo(() => {
    if (!cal || !catalogue) return null;
    return {
      resoudre: resoudreLocal(catalogue),
      joursFermes: cal.joursFermes,
      delais: cal.delais,
      reglement: cal.reglement,
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
  const signauxDate = dateRetrait || tentative ? pour(['dateRetrait', 'datePrise']) : [];
  const signauxHeure = (dateRetrait && lignes.length > 0) || tentative ? pour(['heureRetrait', 'heurePrise']) : [];
  const signauxProduits = tentative || ancienTarif ? pour(['lignes']) : [];
  const signauxPrecisions = pour(['texteGateau', 'demandeInhabituelle']);
  const signauxMontants = acompte !== null || tentative ? pour(['acompte', 'total']) : pour(['total']);
  const signauxStatut = pour(['statut']);

  // --- Actions -----------------------------------------------------------------
  const majLigne = (i: number, partiel: Partial<LigneEcran>) =>
    setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, ...partiel } : l)));
  const retirerLigne = (i: number) => setLignes((ls) => ls.filter((_, j) => j !== i));

  const avecGerant = (raison: string, appliquer: (d: Deverrouillage) => void) => {
    if (parGerant !== null) {
      appliquer({ par: parGerant, le: new Date().toISOString() });
      return;
    }
    setDemande({ raison, appliquer });
  };

  const ajouterProduit = (f: FicheCatalogue) => {
    const ligne = ligneVide(f.produit.id);
    setLignes((ls) => [...ls, ligne]);
    // Number Cake : le nombre de symboles d'abord (il fixe le minimum de parts).
    setActif(f.prix.minParSymbole !== null ? `${ligne.cle}.symboles` : `${ligne.cle}.quantite`);
    setRecherche('');
  };

  const ajouterLigneLibre = () => {
    const ligne = ligneVide(null);
    ligne.libelleLibre = recherche.trim();
    setLignes((ls) => [...ls, ligne]);
    setActif(`${ligne.cle}.quantite`);
    setRecherche('');
  };

  /** Applique la sortie proposée par le domaine (un geste). */
  const corriger = (s: SignalementAffichable, v: unknown) => {
    const i = indexLigne(s.champ);
    const champ = champLocal(s.champ);
    const ligne = i !== null ? lignes[i] : undefined;

    if (s.code === 'ERR_DROIT_INSUFFISANT' || s.code === 'ERR_COMMANDE_LENDEMAIN') {
      if (s.code === 'ERR_COMMANDE_LENDEMAIN') {
        avecGerant('Retrait le lendemain : accord du responsable.', (d) => setAccordLendemain(d));
      } else if (i === null && champ === 'lignes') {
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
        else setActif('heure');
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
        zoneProduits.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
          const so = sortieDe(s, unite);
          return so.avecValeur ? so.libelle : undefined;
        }}
        onCorriger={corriger}
        autreSortiePour={(s) => {
          const so = sortieDe(s, unite);
          const boutons: ReactNode[] = [];
          if (so.libelle && !so.avecValeur) {
            boutons.push(
              <BoutonSortie key="action" onClick={() => corriger(s, undefined)}>
                {so.libelle}
              </BoutonSortie>,
            );
          }
          // Lendemain refusé : l'autre sortie est le premier jour qui n'est plus « le lendemain ».
          if (s.code === 'ERR_COMMANDE_LENDEMAIN' && typeof s.valeurProposee === 'string') {
            const date = s.valeurProposee;
            boutons.push(
              <BoutonSortie key="date" onClick={() => setDateRetrait(date)}>
                {libelleCorrection('ERR_DELAI_TROP_COURT', { delaiJoursOuvres: 0, premiereDate: formaterDate(date) })}
              </BoutonSortie>,
            );
          }
          // Sous le plancher : l'autre sortie est l'accord du gérant.
          const iLigne = indexLigne(s.champ);
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
        accordLendemain,
        texteGateau: texteGateau || null,
        sansEcriture,
        photoWhatsapp,
        photoImprimee,
        demandeInhabituelle,
        remarques: remarques || null,
        lignes: lignes.map((l, i) => ({ ...saisie.lignes[i], precision: l.precision || null })),
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

  return (
    <>
      <Entete
        titre={modification ? `Modifier la commande ${commande.numero}` : 'Nouvelle commande'}
        sousTitre={
          modification ? (
            <>Chaque changement est enregistré et daté. Prix au tarif du jour de la prise de commande.</>
          ) : (
            <>Prise par <span className="font-medium text-ink">{vendeur}</span></>
          )
        }
        actions={<Bouton onClick={() => router.push('/commandes')}>Annuler</Bouton>}
      />

      {refusChargement ? <div className="mb-4">{rendre([refusChargement])}</div> : null}
      {chargement ? (
        <div className="grid gap-3">
          <Chargement libelle="Chargement du tarif et du calendrier…" />
          <RappelChargement />
        </div>
      ) : null}

      {demande ? (
        <div className="mb-4">
          <AccesGerant
            raison={demande.raison}
            onAccorde={(par) => {
              setParGerant(par);
              demande.appliquer({ par, le: new Date().toISOString() });
              setDemande(null);
            }}
            onAnnuler={() => setDemande(null)}
          />
        </div>
      ) : null}

      {cal && catalogue ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 pb-28 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:pb-0">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
            {signauxStatut.length > 0 ? rendre(signauxStatut) : null}

            {/* ---------------------------------------------------- Client */}
            <Carte className="p-4">
              <h2 className={TITRE}>Client</h2>
              <div className="grid gap-3 sm:grid-cols-2">
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
                >
                  <PaveTelephone
                    libelle="Téléphone du client"
                    telephone={telephone}
                    onChange={setTelephone}
                    onValider={() => setActif(null)}
                  />
                </ChampPave>
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
            <Carte className="p-4">
              <SelecteurDateRetrait
                valeur={dateRetrait}
                onChange={(d) => {
                  setDateRetrait(d);
                  setAccordLendemain(null);
                }}
                aujourdhui={cal.aujourdhui}
                premiereDate={premiereDate}
                estJourFerme={(iso) => {
                  const f = fermetureDuJour(iso, cal.joursFermes);
                  return f ? { ferme: true, libelle: f.nature === 'hebdomadaire' ? undefined : f.libelle } : { ferme: false };
                }}
                enErreur={signauxDate.some((s) => s.niveau === 'bloquant')}
              />
              {accordLendemain ? (
                <p className="mt-2 text-sm text-ink-2">Retrait le lendemain accordé par {accordLendemain.par}.</p>
              ) : null}
              {rendre(signauxDate)}

              <div className="mt-4">
                <ChampPave
                  libelle="Heure de retrait"
                  valeur={heureRetrait || null}
                  vide="Choisir l’heure"
                  ouvert={actif === 'heure'}
                  onBasculer={() => setActif(actif === 'heure' ? null : 'heure')}
                  enErreur={signauxHeure.some((s) => s.niveau === 'bloquant')}
                >
                  <ChoixHeure
                    valeur={heureRetrait}
                    onChange={(h, fini) => {
                      setHeureRetrait(h);
                      if (fini) setActif(null);
                    }}
                  />
                </ChampPave>
                {rendre(signauxHeure)}
              </div>
            </Carte>

            {/* -------------------------------------------------- Produits */}
            <div ref={zoneProduits}>
              <Carte className="p-4">
                <h2 className={TITRE}>Produits</h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist">
                  {ENTREES.map((e) => (
                    <Onglet key={e.regime} actif={entree === e.regime} onClick={() => setEntree(e.regime)} titre={e.titre} detail={e.detail} />
                  ))}
                  <Onglet actif={entree === 'libre'} onClick={() => setEntree('libre')} titre="Autre demande" detail="Hors catalogue, prix avec le gérant" />
                </div>

                <input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder={entree === 'libre' ? 'Décrire la demande (libellé)' : 'Chercher un produit…'}
                  aria-label="Chercher un produit"
                  autoComplete="off"
                  className={`${CHAMP_TEXTE} mt-3`}
                />

                {entree === 'libre' ? (
                  <div className="mt-3">
                    <p className="text-sm text-ink-2">
                      Les affiches sont « non exhaustives » : toute demande hors liste se prend ici, avec un prix fixé avec le
                      gérant, et la mention « à confirmer par le pâtissier » sur le bon.
                    </p>
                    <Bouton variante="principal" className="mt-2" disabled={recherche.trim() === ''} onClick={ajouterLigneLibre}>
                      Ajouter « {recherche.trim() || '…'} »
                    </Bouton>
                  </div>
                ) : (
                  <ListeProduits catalogue={catalogue} regime={entree} recherche={recherche} onChoisir={ajouterProduit} />
                )}
                {rendre(signauxProduits)}
              </Carte>
            </div>

            {lignes.length > 0 ? (
              <Carte className="p-4">
                <h2 className={TITRE}>Le bon ({lignes.length} ligne{lignes.length > 1 ? 's' : ''})</h2>
                <ul className="grid gap-4">
                  {lignes.map((ligne, i) => {
                    const fiche = ficheDe(catalogue, ligne.produitId);
                    const r = resultatsLignes[i];
                    const unite = uniteDe(fiche);
                    const ouvertIci = actif?.startsWith(`${ligne.cle}.`) ?? false;
                    // Refus qui portent sur PLUSIEURS lignes (suppléments…) : `controlerLigne`
                    // ne les voit pas, `blocagesCommande` si. Affichés sur la ligne dès sa
                    // saisie, sans doubler le refus propre à la ligne.
                    const blocagesLigne = r
                      ? blocages.filter((b) => indexLigne(b.champ) === i && (r.ok || b.code !== r.code))
                      : [];
                    // Ancien tarif : l'accord manquant n'est pas répété sur chaque ligne (refus unique plus haut).
                    const accordAncien = ancienTarif && r && !r.ok && r.code === 'ERR_DROIT_INSUFFISANT' && sansAccord(i);
                    const signaux: SignalementAffichable[] = [
                      ...(r && !accordAncien ? (r.ok ? r.signalements : [r]) : []),
                      ...blocagesLigne,
                      ...tous.filter((s) => indexLigne(s.champ) === i && s.code === 'AVERT_PRODUIT_EN_DOUBLE'),
                    ];
                    return (
                      <li key={ligne.cle} className="rounded-xl border border-line p-3">
                        <LigneEditable
                          ligne={ligne}
                          fiche={fiche}
                          resultat={r}
                          unite={unite}
                          actif={actif}
                          setActif={setActif}
                          options={options}
                          onChange={(p) => majLigne(i, p)}
                          onRetirer={() => retirerLigne(i)}
                          onGerantLibre={() =>
                            avecGerant(`Prix d’une demande hors catalogue : « ${ligne.libelleLibre || 'ligne libre'} ».`, (d) =>
                              majLigne(i, { deverrouillage: d }),
                            )
                          }
                        />
                        {ouvertIci ? null : rendre(signaux, unite, `ligne-${ligne.cle}`)}
                      </li>
                    );
                  })}
                </ul>
              </Carte>
            ) : null}

            {/* ------------------------------------------------ Précisions */}
            <Carte className="p-4">
              <h2 className={TITRE}>Précisions</h2>
              <label className="block">
                <span className="mb-1 block text-sm text-ink-2">Écriture sur le gâteau</span>
                <input
                  className={CHAMP_TEXTE}
                  value={texteGateau}
                  disabled={sansEcriture}
                  onChange={(e) => setTexteGateau(e.target.value)}
                  placeholder="JOYEUX ANNIVERSAIRE MARIAM"
                  autoComplete="off"
                />
              </label>
              <p className="mt-1 text-sm text-ink-3">
                Relisez-le au client à voix haute : il est imprimé tel quel. Le supplément « écriture » se prend dans
                « Gâteaux sur commande ».
              </p>
              <Case coche={sansEcriture} onChange={(v) => { setSansEcriture(v); if (v) setTexteGateau(''); }}>
                Pas d’écriture sur le gâteau
              </Case>
              <Case coche={photoWhatsapp} onChange={setPhotoWhatsapp}>
                Photo d’exemple envoyée sur WhatsApp
              </Case>
              <Case coche={photoImprimee} onChange={setPhotoImprimee}>
                Photo à imprimer sur le gâteau (ajoutez le supplément « Photo » dans « Gâteaux sur commande »)
              </Case>
              <Case coche={demandeInhabituelle} onChange={setDemandeInhabituelle}>
                Demande inhabituelle (ingrédient particulier, moule spécial…)
              </Case>
              {rendre(signauxPrecisions)}
              <label className="mt-3 block">
                <span className="mb-1 block text-sm text-ink-2">Remarques</span>
                <textarea className={`${CHAMP_TEXTE} min-h-20 py-2`} value={remarques} onChange={(e) => setRemarques(e.target.value)} />
              </label>
            </Carte>
          </div>

          {/* ------------------------------------------------------ Total */}
          <Carte className="p-4 lg:sticky lg:top-4">
            <div className="text-sm text-ink-2">Total à annoncer</div>
            <div className="chiffres text-5xl font-bold leading-tight text-ink">{formaterEuros(total)}</div>
            {lignesOk.length > 0 ? (
              <ul className="mt-2 grid gap-0.5 text-sm text-ink-2">
                {lignesOk.map((l, k) => (
                  <li key={k} className="chiffres">
                    {l.libelle} : {composantes(l, l.basePrix === 'personne' ? 'parts' : 'pièces')}
                  </li>
                ))}
                {lignesOk.length > 1 ? (
                  <li className="chiffres font-medium text-ink">
                    {lignesOk.map((l) => formaterEuros(l.totalCentimes)).join(' + ')} = {formaterEuros(totalTarif)}
                  </li>
                ) : null}
              </ul>
            ) : null}

            <div className="mt-3">
              {remise ? (
                <ChampPave
                  libelle={`Prix convenu (accord de ${remise.par})`}
                  valeur={totalConvenu === null ? null : formaterEuros(totalConvenu)}
                  ouvert={actif === 'total'}
                  onBasculer={() => setActif(actif === 'total' ? null : 'total')}
                >
                  <PaveMontant
                    libelle="Prix convenu avec le client"
                    sousTitre={`Tarif : ${formaterEuros(totalTarif)}`}
                    centimes={totalConvenu}
                    onChange={setTotalConvenu}
                    onValider={() => setActif(null)}
                    champ="total"
                  />
                </ChampPave>
              ) : (
                <button
                  type="button"
                  className="text-sm text-ink-2 underline underline-offset-2"
                  onClick={() => avecGerant('Prix convenu sous le tarif (remise).', (d) => { setRemise(d); setActif('total'); })}
                >
                  Prix convenu avec le client (accord du gérant)
                </button>
              )}
            </div>

            <div className="mt-4">
              <ChampPave
                libelle="Acompte"
                valeur={acompte === null ? null : formaterEuros(acompte)}
                ouvert={actif === 'acompte'}
                onBasculer={() => setActif(actif === 'acompte' ? null : 'acompte')}
                enErreur={signauxMontants.some((s) => s.niveau === 'bloquant' && champLocal(s.champ) === 'acompte')}
              >
                <PaveMontant
                  libelle="Acompte versé"
                  sousTitre={`au moins ${cal.reglement.acomptePourcentageMin} % du total`}
                  centimes={acompte}
                  onChange={setAcompte}
                  onValider={() => setActif(null)}
                  champ="acompte"
                />
              </ChampPave>
              <div className="mt-2 flex flex-wrap gap-2">
                <Choix actif={modePaiement === 'especes'} onClick={() => setModePaiement('especes')}>Espèces</Choix>
                <Choix actif={modePaiement === 'virement'} onClick={() => setModePaiement('virement')}>Virement</Choix>
              </div>
            </div>
            {rendre(signauxMontants)}

            <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
              <span className="text-base text-ink-2">Reste à payer au retrait</span>
              <span className="chiffres text-xl font-semibold text-ink">{formaterEuros(reste)}</span>
            </div>

            {refusServeur ? rendre([refusServeur]) : null}

            <Bouton variante="principal" className="mt-4 min-h-14 w-full text-lg" disabled={envoi} onClick={() => void valider()}>
              {envoi ? 'Enregistrement…' : modification ? 'Enregistrer les changements' : 'Valider la commande'}
            </Bouton>
          </Carte>
        </div>
      ) : null}

      {/* Sur téléphone : total et validation toujours à portée de pouce. */}
      {cal && catalogue ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
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
      nbObjets: l.nbObjets ?? null,
      precision: l.precision ?? '',
      deverrouillage: accordPar && accordLe ? { par: accordPar, le: accordLe } : null,
    };
  });
}

function LigneEditable({
  ligne,
  fiche,
  resultat,
  unite,
  actif,
  setActif,
  options,
  onChange,
  onRetirer,
  onGerantLibre,
}: {
  ligne: LigneEcran;
  fiche: FicheTarifee | null;
  resultat: Resultat<LigneControlee> | null;
  unite: string;
  actif: string | null;
  setActif: (a: string | null) => void;
  options: OptionsGateau | null;
  onChange: (p: Partial<LigneEcran>) => void;
  onRetirer: () => void;
  onGerantLibre: () => void;
}) {
  const id = (champ: string) => `${ligne.cle}.${champ}`;
  const basculer = (champ: string) => setActif(actif === id(champ) ? null : id(champ));
  const fermer = () => setActif(null);
  const libre = ligne.produitId === null;
  const regime = fiche?.produit.regimePrix ?? null;
  const plancher = regime === 'C' && fiche?.prix.prixEstPlancher === true;
  const auKilo = fiche?.produit.unite === 'kg';
  const controlee = resultat?.ok ? resultat.donnees : null;
  const suggestions = regime === 'B' ? options?.garnitures : regime === 'C' ? options?.parfums : undefined;

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
              className={CHAMP_TEXTE}
            />
          ) : (
            <p className="text-lg font-semibold text-ink">{fiche ? libelleProduit(fiche) : 'Produit absent du tarif'}</p>
          )}
          <p className="text-sm text-ink-2">
            {libre
              ? 'Autre demande — à confirmer par le pâtissier'
              : regime === 'B'
                ? 'Salé sur commande'
                : regime === 'C'
                  ? 'Gâteau sur commande'
                  : 'Catalogue comptoir'}
          </p>
        </div>
        <button
          type="button"
          onClick={onRetirer}
          className="min-h-12 min-w-12 rounded-xl border border-line text-2xl leading-none text-ink-3 hover:text-bloquant"
          aria-label="Retirer la ligne"
        >
          ×
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {fiche?.prix.minParSymbole != null ? (
          <ChampPave
            libelle="Chiffres ou lettres"
            valeur={ligne.nbSymboles === null ? null : `${ligne.nbSymboles}`}
            ouvert={actif === id('symboles')}
            onBasculer={() => basculer('symboles')}
          >
            <PaveEntier
              libelle="Nombre de chiffres ou lettres (« 25 » = 2)"
              contexte="commande"
              libelleUnite="symboles"
              quantite={ligne.nbSymboles}
              onChange={(n) => onChange({ nbSymboles: n })}
              onValider={() => setActif(id('quantite'))}
              champ="nbSymboles"
            />
          </ChampPave>
        ) : null}

        <ChampPave
          libelle={auKilo ? 'Poids' : unite === 'parts' ? 'Parts' : 'Quantité'}
          valeur={ligne.quantite === null ? null : auKilo ? formaterQuantite('kg', ligne.quantite) : `${ligne.quantite} ${unite}`}
          ouvert={actif === id('quantite')}
          onBasculer={() => basculer('quantite')}
        >
          {auKilo ? (
            <PaveDecimalPoids
              libelle={fiche ? libelleProduit(fiche) : 'Poids'}
              contexte="commande"
              grammes={ligne.quantite}
              onChange={(g) => onChange({ quantite: g })}
              onValider={fermer}
            />
          ) : (
            <PaveEntier
              libelle={fiche ? libelleProduit(fiche) : ligne.libelleLibre || 'Quantité'}
              contexte="commande"
              libelleUnite={unite}
              quantite={ligne.quantite}
              onChange={(q) => onChange({ quantite: q })}
              onValider={() => (plancher || libre ? setActif(id('prix')) : fermer())}
            />
          )}
        </ChampPave>

        {plancher || libre ? (
          <ChampPave
            libelle={libre ? 'Prix unitaire' : unite === 'parts' ? 'Prix par personne' : 'Prix à la pièce'}
            valeur={
              ligne.prixUnitaireCentimes !== null
                ? formaterEuros(ligne.prixUnitaireCentimes)
                : plancher && fiche
                  ? formaterEuros(fiche.prix.prixCentimes)
                  : null
            }
            ouvert={actif === id('prix')}
            onBasculer={() => basculer('prix')}
          >
            <PaveMontant
              libelle={libre ? 'Prix fixé avec le gérant' : 'Prix par personne'}
              sousTitre={plancher && fiche ? `à partir de ${formaterEuros(fiche.prix.prixCentimes)}, modifiable vers le haut` : undefined}
              centimes={ligne.prixUnitaireCentimes ?? (plancher && fiche ? fiche.prix.prixCentimes : null)}
              onChange={(c) => onChange({ prixUnitaireCentimes: c, deverrouillage: libre ? ligne.deverrouillage : null })}
              onValider={fermer}
              champ="prixCentimes"
            />
          </ChampPave>
        ) : null}

        {fiche?.prix.maxParUnite ? (
          <ChampPave
            libelle={`Nombre de ${fiche.prix.maxParUnite.objet || 'sandwichs'}`}
            valeur={ligne.nbObjets === null ? null : `${ligne.nbObjets}`}
            ouvert={actif === id('objets')}
            onBasculer={() => basculer('objets')}
          >
            <PaveEntier
              libelle="Nombre total demandé"
              contexte="commande"
              libelleUnite={fiche.prix.maxParUnite.objet || 'sandwichs'}
              quantite={ligne.nbObjets}
              onChange={(n) => onChange({ nbObjets: n })}
              onValider={fermer}
              champ="nbObjets"
            />
          </ChampPave>
        ) : null}
      </div>

      {controlee ? (
        <p className="chiffres mt-2 text-lg font-semibold text-ink">{composantes(controlee, unite)}</p>
      ) : ligne.quantite === null ? (
        <p className="mt-2 text-sm text-ink-2">Touchez « {auKilo ? 'Poids' : unite === 'parts' ? 'Parts' : 'Quantité'} » pour saisir.</p>
      ) : null}

      {ligne.deverrouillage ? (
        <p className="mt-1 text-sm text-ink-2">Accord de {ligne.deverrouillage.par} enregistré avec la commande.</p>
      ) : null}

      <input
        value={ligne.precision}
        onChange={(e) => onChange({ precision: e.target.value })}
        placeholder={regime === 'B' ? 'Garnitures, répartition…' : 'Parfum, forme, précision…'}
        aria-label="Précision imprimée sur le bon"
        className={`${CHAMP_TEXTE} mt-2`}
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

      {libre ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
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

function ListeProduits({
  catalogue,
  regime,
  recherche,
  onChoisir,
}: {
  catalogue: CatalogueCommande;
  regime: RegimePrix;
  recherche: string;
  onChoisir: (f: FicheCatalogue) => void;
}) {
  const mots = normaliser(recherche).split(' ').filter(Boolean);
  const fiches = catalogue.fiches.filter(
    (f) =>
      f.produit.regimePrix === regime &&
      mots.every((m) => normaliser(`${f.produit.produit} ${f.produit.sousCategorie ?? ''} ${f.produit.categorie}`).includes(m)),
  );
  // Comptoir : favoris d'abord quand on ne cherche rien (liste d'accès rapide, LOI 4).
  const visibles = regime === 'A' && mots.length === 0 ? fiches.filter((f) => f.produit.estFavori) : fiches;

  if (visibles.length === 0) {
    return (
      <p className="mt-3 text-sm text-ink-2">
        {mots.length > 0 ? 'Aucun produit trouvé. Une demande hors liste se prend dans « Autre demande ».' : 'Aucun produit dans ce tarif.'}
      </p>
    );
  }

  return (
    <ul className="mt-3 grid max-h-96 gap-1.5 overflow-y-auto overscroll-contain sm:grid-cols-2">
      {visibles.slice(0, 60).map((f) => (
        <li key={f.produit.id}>
          <button
            type="button"
            onClick={() => onChoisir(f)}
            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-left hover:bg-surface-2"
          >
            <span className="min-w-0">
              <span className="block text-base text-ink">{libelleProduit(f)}</span>
              <span className="block text-sm text-ink-3">
                {f.produit.categorie}
                {f.prix.minParSymbole !== null
                  ? ` · min. ${f.prix.minParSymbole} parts par chiffre ou lettre`
                  : f.prix.minQuantite !== null
                    ? ` · min. ${f.prix.minQuantite} ${f.prix.basePrix === 'personne' ? 'parts' : 'pièces'}`
                    : ''}
              </span>
            </span>
            <span className="chiffres shrink-0 text-base text-ink-2">
              {f.prix.prixEstPlancher ? 'dès ' : ''}
              {formaterEuros(f.prix.prixCentimes)}
              {f.prix.basePrix === 'kg' ? '/kg' : f.prix.basePrix === 'personne' ? '/pers.' : ''}
            </span>
          </button>
        </li>
      ))}
    </ul>
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

/** Heure de retrait au doigt : heures puis quarts d'heure. Aucune heure n'est interdite ici (le domaine juge). */
function ChoixHeure({ valeur, onChange }: { valeur: string; onChange: (h: string, fini: boolean) => void }) {
  const [hh, mm] = valeur ? valeur.split(':') : ['', ''];
  const heures = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-6 gap-1.5">
        {heures.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => onChange(`${h}:${mm || '00'}`, false)}
            className={`chiffres min-h-12 rounded-xl border-2 text-lg ${h === hh ? 'border-sortie bg-sortie text-sortie-texte' : 'border-line-fort bg-surface text-ink'}`}
          >
            {h}h
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {minutes.map((m) => (
          <button
            key={m}
            type="button"
            disabled={!hh}
            onClick={() => onChange(`${hh}:${m}`, true)}
            className={`chiffres min-h-12 rounded-xl border-2 text-lg disabled:opacity-50 ${m === mm ? 'border-sortie bg-sortie text-sortie-texte' : 'border-line-fort bg-surface text-ink'}`}
          >
            :{m}
          </button>
        ))}
      </div>
    </div>
  );
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

function Onglet({ actif, onClick, titre, detail }: { actif: boolean; onClick: () => void; titre: string; detail: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={actif}
      onClick={onClick}
      className={`min-h-16 rounded-xl border-2 px-3 py-2 text-left ${actif ? 'border-accent bg-accent-doux' : 'border-line-fort bg-surface'}`}
    >
      <span className="block text-base font-semibold text-ink">{titre}</span>
      <span className="block text-xs text-ink-2">{detail}</span>
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

function Case({ coche, onChange, children }: { coche: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="mt-3 flex min-h-12 items-center gap-3 text-base text-ink">
      <input type="checkbox" checked={coche} onChange={(e) => onChange(e.target.checked)} className="h-6 w-6 shrink-0 accent-[var(--accent)]" />
      <span>{children}</span>
    </label>
  );
}
