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

import { useCallback, useMemo, useState } from 'react';
import { Alerte, Bouton, Carte, Chargement, Entete, EtatVide, Progression, Puce } from '@/components/ui';
import { BandeauOnglets, Onglet } from '@/components/BandeauOnglets';
import { GestionParcours } from '@/components/GestionParcours';
import { IndicateurSauvegarde } from '@/components/IndicateurSauvegarde';
import { LigneSaisie } from '@/components/LigneSaisie';
import { PaveSaisieProduit } from '@/components/inventaire/PaveSaisieProduit';
import { SignalementsLigne } from '@/components/inventaire/SignalementsLigne';
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
import { classerSelonParcours, useParcours } from '@/lib/parcours';
import { trierCategories } from '@/lib/postes';
import { usePreferencesSaisie } from '@/lib/preferencesSaisie';
import { useSaisieJournee, type Produit } from '@/lib/useSaisieJournee';

type Section = { cle: string; libelle: string; produits: Produit[] };

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

  const { preferences, definir: definirPreference, reinitialiser } = usePreferencesSaisie();
  const saisie = useSaisieJournee({ date, champ: 'quantiteRestante' });
  const trajet = useParcours(date);

  const enRecherche = recherche.trim().length > 0;
  const modeFocus = preferences.mode === 'focus';
  const modePave = preferences.clavier === 'pave';

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

  const sections = useMemo<Section[]>(() => {
    if (enRecherche) {
      const terme = recherche.trim().toLowerCase();
      return [
        {
          cle: 'recherche',
          libelle: `Résultats pour « ${recherche.trim()} »`,
          produits: produitsOrdonnes.filter((p) => p.nom.toLowerCase().includes(terme)),
        },
      ];
    }

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
  }, [produitsOrdonnes, preferences.decoupage, enRecherche, recherche, modeFocus]);

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
      setSelectionne(produitsVisibles[cible].id);
    },
    [produitsVisibles, indexSelectionne]
  );

  const allerALaSection = (index: number) => {
    if (index < 0 || index >= sections.length) return;
    setIndexSection(index);
    // Le changement de page est le bon moment pour reclasser : rien n'est en
    // cours de frappe, et le vendeur s'attend à voir la suite de son travail.
    reclasser();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
  const blocSignalements = (produit: Produit) => {
    const liste = signalementsDe(produit);
    return liste.length > 0 ? (
      <SignalementsLigne signalements={liste} onEffacer={() => compter(produit.id, '')} />
    ) : undefined;
  };

  /* --------------------------------------------------------------- Affichage */

  // Deux colonnes dès le téléphone : sur une page de 17 produits, ça fait
  // 9 rangées au lieu de 17, donc environ deux fois moins de défilement.
  const classesGrille = {
    auto: 'grid-cols-2 lg:grid-cols-3',
    '1': 'grid-cols-1',
    '2': 'grid-cols-2',
  }[preferences.colonnes];

  const enGrille = preferences.colonnes !== '1';
  const ongletsVisibles = !enRecherche && !modeFocus && sections.length > 1;
  const parPages = preferences.decoupage === 'pages';

  const nonComptes = saisie.produits.length - saisie.nbRenseignes;
  const comptageTermine = saisie.produits.length > 0 && nonComptes === 0;

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

  // Inventaire terminé (tout compté ET enregistré) : un rappel d'équipe, une fois par journée.
  const inventaireTermine = comptageTermine && saisie.statut === 'enregistre' && saisie.nbEnAttente === 0;
  if (inventaireTermine && termineLe !== date) setTermineLe(date);
  const avertissementDebut = debutControle?.date === date ? debutControle.signalements : [];

  const bornesSection =
    sectionCourante && sectionCourante.produits.length > 0
      ? `${sectionCourante.produits[0].nom} → ${sectionCourante.produits[sectionCourante.produits.length - 1].nom}`
      : null;

  return (
    <div className={paveVisible ? 'pb-[30rem]' : ''}>
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
            <ReglagesSaisie
              preferences={preferences}
              onChanger={definirPreference}
              onReinitialiser={reinitialiser}
            />
            <SelecteurJournee date={date} onChange={changerDate} libelle="Journée" />
          </>
        }
      />

      {avertissementDebut.map((s) => (
        <Signalement
          key={s.code}
          signalement={s}
          className="sans-impression mb-3"
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
      ))}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-3">
          {rechercheOuverte ? null : (
            <button
              type="button"
              onClick={() => setRechercheOuverte(true)}
              aria-label="Chercher un produit"
              className="sans-impression flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs text-ink-2 hover:border-line-fort hover:text-ink"
            >
              Chercher
            </button>
          )}
          <Progression fait={saisie.nbRenseignes} total={saisie.produits.length} />
          {nonComptes > 0 && !saisie.chargement ? (
            <span className="hidden text-xs text-ink-3 sm:inline">
              {nonComptes} pas encore compté{nonComptes > 1 ? 's' : ''}
            </span>
          ) : null}
        </div>
        <IndicateurSauvegarde
          statut={saisie.statut}
          derniereSauvegarde={saisie.derniereSauvegarde}
          nbEnAttente={saisie.nbEnAttente}
          messageErreur={saisie.messageErreur}
          onReessayer={() => void saisie.enregistrerMaintenant()}
        />
      </div>

      {/* La recherche réordonne toute la liste : elle reste repliée tant qu'on
          ne la demande pas, pour ne pas casser l'ordre pendant un comptage. */}
      {rechercheOuverte ? (
        <div className="sans-impression mb-3 flex gap-2">
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
      ) : null}

      {ongletsVisibles ? (
        <div className="mb-3">
          <BandeauOnglets ariaLabel={parPages ? 'Pages' : 'Zones du magasin'}>
            {sections.map((section, index) => {
              const { faits, total } = avancementSection(section.produits);
              return (
                <Onglet
                  key={section.cle}
                  libelle={parPages ? `Page ${section.libelle}` : section.libelle}
                  detail={`${faits}/${total}`}
                  actif={index === indexBorne}
                  etat={faits === total && total > 0 ? 'complet' : faits > 0 ? 'partiel' : 'vide'}
                  onClick={() => allerALaSection(index)}
                />
              );
            })}
          </BandeauOnglets>
        </div>
      ) : null}

      {saisie.erreurChargement ? (
        <Alerte>
          {saisie.erreurChargement}{' '}
          <button onClick={() => void saisie.recharger()} className="underline underline-offset-2">
            Recharger
          </button>
        </Alerte>
      ) : null}

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
        <Carte>
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-ink">
                {enRecherche
                  ? sectionCourante?.libelle
                  : parPages && sectionCourante
                    ? `Page ${sectionCourante.libelle} sur ${sections.length} · ${libellePage(sectionCourante.produits)}`
                    : sectionCourante?.libelle}
              </h2>
              {bornesSection && !enRecherche ? (
                <p className="truncate text-xs text-ink-3">{bornesSection}</p>
              ) : null}
            </div>
            <span className="chiffres shrink-0 text-xs text-ink-3">
              {produitsVisibles.length} produits
            </span>
          </div>

          <div
            className={
              enGrille
                ? `grid ${classesGrille} ${preferences.densite === 'compact' ? 'gap-1.5 p-2' : 'gap-2 p-3'}`
                : ''
            }
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
                  variante={enGrille ? 'carte' : 'ligne'}
                  signalements={blocSignalements(produit)}
                />
              );
            })}
          </div>
        </Carte>
      )}

      {ongletsVisibles ? (
        <div
          className={`sans-impression mt-4 flex items-center justify-between gap-3 ${
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
        <div className="sans-impression mt-4 flex justify-center">
          <Bouton variante="secondaire" onClick={reclasser}>
            Reclasser — {dejaComptesDansLaPage} produit
            {dejaComptesDansLaPage > 1 ? 's' : ''} de cette page {dejaComptesDansLaPage > 1 ? 'sont comptés' : 'est compté'}
          </Bouton>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <Puce ton={comptageTermine ? 'ok' : 'neutre'}>
          <span className="chiffres">{saisie.nbRenseignes}</span> / {saisie.produits.length} comptés
        </Puce>
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

      <RappelApresAction
        moment="apres_inventaire"
        declencheur={termineLe === date ? date : null}
        className="sans-impression mt-4"
      />

      <RappelsService comptageTermine={comptageTermine} />

      {paveVisible && produitSelectionne ? (
        <PaveSaisieProduit
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
          main={preferences.main}
          onSuivant={() => allerAuProduit(1)}
          peutAllerSuivant={indexSelectionne < produitsVisibles.length - 1}
          onFermer={fermerPave}
        />
      ) : null}
    </div>
  );
}
