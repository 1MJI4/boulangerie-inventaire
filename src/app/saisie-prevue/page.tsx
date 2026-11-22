'use client';

// Écran du manager, quelques heures avant la fournée : il note ce qu'il veut
// voir produit. Dès qu'il saisit, le pâtissier le voit sur son écran.
//
// En pratique il ne planifie presque que la viennoiserie. C'est donc le rayon
// choisi à l'arrivée ; les autres (Pains, Salé…) sont un toucher plus loin, dans
// les boutons du haut, avec le nombre de quantités déjà demandées dessous
// (propriétaire, 20/11/2026). Sur chaque ligne, les RESTES du dernier comptage
// passent en premier : c'est l'information qui décide de la quantité.
//
// LOI 2 : un produit au kilo se planifie en poids (grammes), au pavé décimal ;
// le « + commande » (1 + 11) reste réservé aux produits à la pièce.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Alerte, Bouton, Carte, Chargement, Entete, EtatVide, Progression, Puce } from '@/components/ui';
import { IndicateurSauvegarde } from '@/components/IndicateurSauvegarde';
import { LigneSaisie } from '@/components/LigneSaisie';
import { SelecteurJournee } from '@/components/SelecteurJournee';
import { BandeauCommandes } from '@/components/BandeauCommandes';
import { formatDateCourt, formatDateLong, journeeProduction } from '@/lib/dateProduction';
import { useRestesVeille } from '@/lib/useRestesVeille';
import { Segmente } from '@/components/fiche/ElementsCommande';
import { LIBELLE_POSTE, trierCategories } from '@/lib/postes';
import { formatHeure, useHistoriqueProduit } from '@/lib/useHistoriqueProduit';
import { useSaisieJournee, type Produit } from '@/lib/useSaisieJournee';
import { PaveSaisieProduit } from '@/components/inventaire/PaveSaisieProduit';
import { focaliserLigne, useLigneActiveEnVue } from '@/components/inventaire/ligneActive';
import { DispositionAvecPave } from '@/components/saisie/DispositionAvecPave';
import { SignalementsLigne } from '@/components/inventaire/SignalementsLigne';
import { RappelChargement } from '@/components/rappels';
import { formaterQuantite } from '@/domaine/unites';
import {
  enPlateaux,
  formaterPlateaux,
  piecesDePlateaux,
  sePlanifieEnPlateaux,
  suggestionEnPlateaux,
} from '@/domaine/plateaux';
import { formaterDerives, preremplirCommandes } from '@/domaine/commandesFournil';
import { usePartCommandee } from '@/lib/usePartCommandee';

/** Le rayon que le manager planifie tous les jours. */
const RAYON_PRINCIPAL = 'Viennoiserie';

export default function SaisiePrevisions() {
  const [date, setDate] = useState(() => journeeProduction());
  const [recherche, setRecherche] = useState('');
  // Le rayon affiché : la viennoiserie à chaque arrivée, les autres au toucher.
  const [rayonChoisi, setRayonChoisi] = useState(RAYON_PRINCIPAL);

  const saisie = useSaisieJournee({ date, champ: 'quantitePrevue' });
  // Rayons masqués par le gérant (Réglages → Prévisions, 22/11/2026) : seulement un affichage.
  const [masques, setMasques] = useState<string[]>([]);
  useEffect(() => {
    let vivant = true;
    fetch('/api/reglages/previsions')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { masques?: string[] } | null) => {
        if (vivant && Array.isArray(j?.masques)) setMasques(j.masques);
      })
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, []);
  const produitsAffiches = useMemo(() => saisie.produits.filter((p) => !masques.includes(p.categorie)), [saisie.produits, masques]);
  // Le « 1 + 11 » des anciennes feuilles : ce qui sort normalement du four, et
  // ce qu'une commande client ajoute. Le fournil produit la somme ; les
  // statistiques pourront écarter la part commandée, qui ne se reproduira pas
  // la semaine suivante.
  const commande = useSaisieJournee({ date, champ: 'quantiteCommande' });
  const { reperes } = useHistoriqueProduit(date);
  const restes = useRestesVeille(date);
  // R72 — commandes prises dans l'application : comptées toutes seules pour le
  // fournil (dérivés compris), affichées ici pour que le manager ne les retape pas.
  const partCommandes = usePartCommandee(date);
  /** Produit au kilo en cours de saisie (pavé décimal ouvert). */
  const [pesee, setPesee] = useState<number | null>(null);
  const produitPese = pesee === null ? null : (saisie.produits.find((p) => p.id === pesee) ?? null);
  const afficher = (produit: Produit, n: number) =>
    produit.unite === 'kg' ? formaterQuantite('kg', n) : String(n);

  /*
   * Plateaux (domaine/plateaux) : pour Croissant et Couque au chocolat, le
   * manager tape un nombre de PLATEAUX entiers. La base garde des pièces :
   * prévue = plateaux × contenance + part commandée (le « + », en pièces).
   */
  const lireEntier = (v: string) => {
    const n = Number(String(v).replace(/[^0-9]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const partCommandee = (produitId: number) => lireEntier(commande.valeurs[produitId] ?? '');
  /*
   * Pièces (hors kg) : le champ principal = la quantité HABITUELLE, le « + » = la commande, le
   * fournil lit la somme (« 12 + 5 » = 17, comme les anciennes feuilles). On tape l'habituel,
   * la commande s'y ajoute d'elle-même (propriétaire, 21/11/2026). La base garde le total.
   */
  const habituelAffiche = (produit: Produit) => {
    const brut = saisie.valeurs[produit.id] ?? '';
    if (brut === '') return '';
    const plus = partCommandee(produit.id);
    const base = Math.max(0, lireEntier(brut) - plus);
    return base === 0 && plus > 0 ? '' : String(base);
  };
  const definirHabituel = (produit: Produit, saisieBrute: string) => {
    const chiffres = saisieBrute.replace(/[^0-9]/g, '');
    const total = (chiffres === '' ? 0 : Number(chiffres)) + partCommandee(produit.id);
    saisie.definir(produit.id, total > 0 ? String(total) : '');
  };
  const plateauxAffiches = (produit: Produit, parPlateau: number) => {
    const brut = saisie.valeurs[produit.id] ?? '';
    if (brut === '') return '';
    const base = Math.max(0, lireEntier(brut) - partCommandee(produit.id));
    return String(enPlateaux(base, parPlateau).plateaux);
  };
  const definirPlateaux = (produit: Produit, parPlateau: number, saisieBrute: string) => {
    const chiffres = saisieBrute.replace(/[^0-9]/g, '');
    const commandees = partCommandee(produit.id);
    if (chiffres === '') {
      saisie.definir(produit.id, commandees > 0 ? String(commandees) : '');
      return;
    }
    const pieces = piecesDePlateaux(Number(chiffres), parPlateau) + commandees;
    saisie.definir(produit.id, pieces > 0 ? String(pieces) : '');
  };

  /*
   * Commandes de croissants et de couques au chocolat (propriétaire, 21/11/2026) : elles
   * PRÉREMPLISSENT les champs du manager — 10 commandées → « + 10 », 36 → 1
   * plateau, 46 → 1 plateau et « + 10 » — puis il modifie comme il veut (domaine :
   * preremplirCommandes), sauf jusqu'à 9 pièces : « 9 en commande » est dit, avec un bouton pour
   * les ajouter. Une seule fois par produit et par journée, et seulement si le
   * « + » est encore vide : ce qu'il a tapé n'est jamais écrasé. Les pièces s'ajoutent à
   * ce qu'il avait déjà demandé.
   */
  const dejaPrerempli = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (saisie.chargement || commande.chargement) return;
    for (const produit of saisie.produits) {
      const cle = `${date}:${produit.id}`;
      if (dejaPrerempli.current.has(cle)) continue;
      const pieces = partCommandes.parProduit.get(produit.id)?.commandeAuto ?? 0;
      if (pieces <= 0 || (commande.valeurs[produit.id] ?? '') !== '') continue;
      // Jusqu'à 4 pièces (tolérance) : rien n'est rempli, la ligne propose seulement de les ajouter.
      const { plateaux, plus } = preremplirCommandes(pieces, produit.piecesParPlateau ?? 0);
      if (plateaux === 0 && plus === 0) continue;
      dejaPrerempli.current.add(cle);
      let deja = false;
      try {
        deja = window.localStorage.getItem(`prevue:prerempli:${cle}`) === '1';
        window.localStorage.setItem(`prevue:prerempli:${cle}`, '1');
      } catch {
        /* stockage indisponible : le « + » vide suffit comme garde */
      }
      if (deja) continue;
      const dejaDemande = lireEntier(saisie.valeurs[produit.id] ?? '');
      // « 0 » (et non vide) quand le « + » reste à 0 : le préremplissage est fait, l'écran du pâtissier le sait.
      commande.definir(produit.id, String(plus));
      saisie.definir(produit.id, String(dejaDemande + (sePlanifieEnPlateaux(produit.piecesParPlateau) ? piecesDePlateaux(plateaux, produit.piecesParPlateau) : 0) + plus));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une fois par produit et par journée (garde ci-dessus)
  }, [saisie.chargement, commande.chargement, saisie.produits, partCommandes.parProduit, date]);

  /**
   * Le complément s'ajoute au total, il ne le remplace pas : le manager avait
   * prévu 12, une commande de 5 arrive, il tape 5 dans le « + » et le fournil
   * lit 17. Corriger le « + » corrige le total du même écart.
   */
  const ajusterCommande = (produitId: number, saisieBrute: string) => {
    const lire = (v: string) => {
      const n = Number(v.replace(/[^0-9]/g, ''));
      return Number.isFinite(n) ? n : 0;
    };
    const ancien = lire(commande.valeurs[produitId] ?? '');
    const nouveau = lire(saisieBrute);
    const total = lire(saisie.valeurs[produitId] ?? '');
    const suivant = Math.max(0, total - ancien + nouveau);

    commande.definir(produitId, saisieBrute.replace(/[^0-9]/g, ''));
    if (suivant !== total) saisie.definir(produitId, suivant === 0 ? '' : String(suivant));
  };

  const enRecherche = recherche.trim().length > 0;

  /* ------------------------------------------------------------- Rayons */

  const rayons = useMemo(() => {
    const groupes = new Map<string, Produit[]>();
    const terme = recherche.trim().toLowerCase();

    for (const produit of produitsAffiches) {
      if (terme && !produit.nom.toLowerCase().includes(terme)) continue;
      const liste = groupes.get(produit.categorie) ?? [];
      liste.push(produit);
      groupes.set(produit.categorie, liste);
    }

    return trierCategories([...groupes.keys()]).map((categorie) => {
      const produits = groupes.get(categorie) ?? [];
      const remplis = produits.filter((p) => (saisie.valeurs[p.id] ?? '') !== '').length;
      return { categorie, produits, remplis };
    });
  }, [produitsAffiches, saisie.valeurs, recherche]);

  // Les boutons du haut : la viennoiserie d'abord, puis les autres rayons dans l'ordre habituel.
  const nomsRayons = useMemo(() => {
    const tous = new Set(produitsAffiches.map((p) => p.categorie));
    return [...tous].sort((a, b) =>
      a === RAYON_PRINCIPAL ? -1 : b === RAYON_PRINCIPAL ? 1 : trierCategories([a, b])[0] === a ? -1 : 1,
    );
  }, [produitsAffiches]);
  // Rayon choisi absent de la liste (liste vide, rayon renommé) : le premier existant.
  const rayonActif = nomsRayons.includes(rayonChoisi) ? rayonChoisi : (nomsRayons[0] ?? rayonChoisi);
  // La recherche traverse tous les rayons ; sinon, un seul rayon à la fois.
  const rayonsAffiches = enRecherche ? rayons : rayons.filter((r) => r.categorie === rayonActif);
  const demandesParRayon = useMemo(() => {
    const n = new Map<string, number>();
    for (const p of saisie.produits) {
      if ((saisie.valeurs[p.id] ?? '') !== '') n.set(p.categorie, (n.get(p.categorie) ?? 0) + 1);
    }
    return n;
  }, [saisie.produits, saisie.valeurs]);

  /* -------------------------------------------------- Aide à la décision */

  const appliquerLesReperes = (produits: Produit[]) => {
    for (const produit of produits) {
      if ((saisie.valeurs[produit.id] ?? '') !== '') continue;
      const moyenne = reperes.get(produit.id)?.moyenneProduite;
      if (moyenne == null || moyenne <= 0) continue;
      if (sePlanifieEnPlateaux(produit.piecesParPlateau)) {
        const plateaux = suggestionEnPlateaux(moyenne, produit.piecesParPlateau);
        if (plateaux != null) definirPlateaux(produit, produit.piecesParPlateau, String(plateaux));
      } else {
        definirHabituel(produit, String(moyenne));
      }
    }
  };

  const oublisProbables = useMemo(
    () =>
      saisie.produits.filter((p) => {
        const repere = reperes.get(p.id);
        return (
          p.categorie === RAYON_PRINCIPAL &&
          (saisie.valeurs[p.id] ?? '') === '' &&
          repere?.moyenneProduite != null &&
          repere.moyenneProduite > 0
        );
      }),
    [saisie.produits, saisie.valeurs, reperes]
  );

  const postesConcernes = useMemo(() => {
    const vus = new Set(
      saisie.produits.filter((p) => (saisie.valeurs[p.id] ?? '') !== '').map((p) => p.poste)
    );
    return [...vus];
  }, [saisie.produits, saisie.valeurs]);

  /* ------------------------------------------- Enchaînement de la saisie */

  // Ordre affiché à l'écran : « suivant » = la ligne juste en dessous.
  const ordreAffiche = rayonsAffiches.flatMap(({ produits }) => produits);

  /**
   * Passe au produit affiché après `produitId` : pavé décimal s'il est au kilo
   * (LOI 2), sinon le curseur va dans son champ. Toujours amené en vue.
   */
  const passerAuSuivant = (produitId: number) => {
    const index = ordreAffiche.findIndex((p) => p.id === produitId);
    const suivant = index >= 0 ? ordreAffiche[index + 1] : undefined;
    if (!suivant) {
      setPesee(null);
      return;
    }
    if (suivant.unite === 'kg') {
      setPesee(suivant.id);
      return;
    }
    setPesee(null);
    requestAnimationFrame(() => focaliserLigne(suivant.id));
  };
  const indexPese = produitPese ? ordreAffiche.findIndex((p) => p.id === produitPese.id) : -1;

  // La ligne pesée n'est jamais cachée par le pavé.
  useLigneActiveEnVue(produitPese?.id ?? null, produitPese !== null);

  const pave = produitPese ? (
    <PaveSaisieProduit
      key={produitPese.id}
      produit={produitPese}
      valeur={saisie.valeurs[produitPese.id] ?? ''}
      onChange={(v) => saisie.definir(produitPese.id, v)}
      onSuivant={() => passerAuSuivant(produitPese.id)}
      peutAllerSuivant={indexPese >= 0 && indexPese < ordreAffiche.length - 1}
      onFermer={() => setPesee(null)}
    />
  ) : null;

  return (
    <div>
      <Entete
        titre="Prévisions de production"
        sousTitre={
          <>
            Quantités demandées pour le{' '}
            <span className="font-medium capitalize text-ink">{formatDateLong(date)}</span>
          </>
        }
        actions={<SelecteurJournee date={date} onChange={setDate} libelle="À produire" />}
      />

      <DispositionAvecPave pave={pave}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Progression fait={saisie.nbRenseignes} total={saisie.produits.length} />
            {postesConcernes.length > 0 ? (
              <span className="text-xs text-ink-3">
                visible par {postesConcernes.map((p) => LIBELLE_POSTE[p]).join(' et ')}
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

        {!enRecherche && nomsRayons.length > 1 ? (
          <div className="sans-impression mb-4">
            <Segmente<string>
              libelle="Rayon"
              valeur={rayonActif}
              onChange={setRayonChoisi}
              nombreDessous
              options={nomsRayons.map((r) => ({ valeur: r, libelle: r, nombre: demandesParRayon.get(r) ?? 0 }))}
            />
          </div>
        ) : null}

        <div className="sans-impression mb-4">
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher un produit dans tous les rayons…"
            aria-label="Chercher un produit"
            className="h-11 w-full rounded-xl border border-transparent bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none sm:max-w-80"
          />
        </div>

        <BandeauCommandes journee={date} />

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
            <Chargement libelle="Chargement de la liste des produits…" />
            <RappelChargement className="mx-auto max-w-md" />
          </>
        ) : rayonsAffiches.length === 0 ? (
          <Carte>
            <EtatVide titre="Aucun produit ne correspond" detail="Essayez un autre mot." />
          </Carte>
        ) : (
          <div className="space-y-3">
            {rayonsAffiches.map(({ categorie, produits, remplis }) => {
              const ouvert = true;
              const avecReperes = produits.filter(
                (p) => (reperes.get(p.id)?.moyenneProduite ?? 0) > 0
              ).length;

              return (
                <Carte key={categorie}>
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4">
                    <h2 className="flex min-h-11 items-center text-sm font-semibold text-ink">{categorie}</h2>

                    <div className="flex items-center gap-3">
                      {remplis > 0 ? (
                        <Puce ton="accent">
                          <span className="chiffres">{remplis}</span> demandé{remplis > 1 ? 's' : ''}
                        </Puce>
                      ) : null}
                      <Progression fait={remplis} total={produits.length} />
                    </div>
                  </div>

                  {ouvert ? (
                    <>
                      {avecReperes > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-2 px-4 py-2">
                          <span className="text-xs text-ink-2">
                            L&apos;historique donne un repère pour{' '}
                            <span className="chiffres font-medium text-ink">{avecReperes}</span>{' '}
                            produits de ce rayon.
                          </span>
                          <button
                            type="button"
                            onClick={() => appliquerLesReperes(produits)}
                            className="text-xs font-medium text-accent underline underline-offset-2 hover:text-accent-fort"
                          >
                            Pré-remplir les champs vides
                          </button>
                        </div>
                      ) : null}

                      <div className="border-t border-line">
                        {produits.map((produit) => {
                          const repere = reperes.get(produit.id);
                          const reste = restes.parProduit.get(produit.id) ?? null;
                          const auPoids = produit.unite === 'kg';
                          const partAuto = partCommandes.parProduit.get(produit.id);
                          const commandeAuto = partAuto?.commandeAuto ?? 0;
                          const derives = formaterDerives(partAuto?.detail ?? []);
                          const { plus: plusAuto, facultatif } =
                            sePlanifieEnPlateaux(produit.piecesParPlateau)
                              ? preremplirCommandes(commandeAuto, produit.piecesParPlateau)
                              : { plus: 0, facultatif: 0 };
                          const refus = saisie.refus.get(produit.id) ?? commande.refus.get(produit.id);
                          const parPlateau = sePlanifieEnPlateaux(produit.piecesParPlateau)
                            ? produit.piecesParPlateau
                            : null;
                          const suggestionPlateaux =
                            parPlateau !== null
                              ? suggestionEnPlateaux(repere?.moyenneProduite, parPlateau)
                              : null;
                          // Ancienne prévision en pièces qui ne tombe pas juste :
                          // on l'affiche telle quelle, le manager la retape en plateaux.
                          const baseHorsCommande =
                            parPlateau !== null && (saisie.valeurs[produit.id] ?? '') !== ''
                              ? Math.max(0, lireEntier(saisie.valeurs[produit.id]) - partCommandee(produit.id))
                              : 0;
                          const resteAncien =
                            parPlateau !== null ? enPlateaux(baseHorsCommande, parPlateau).reste : 0;
                          return (
                            <LigneSaisie
                              key={produit.id}
                              produitId={produit.id}
                              onEntree={() => passerAuSuivant(produit.id)}
                              nom={produit.nom}
                              unite={produit.unite}
                              selectionne={pesee === produit.id}
                              onSelectionner={auPoids ? () => setPesee(produit.id) : undefined}
                              valeur={
                                parPlateau !== null
                                  ? plateauxAffiches(produit, parPlateau)
                                  : auPoids
                                    ? (saisie.valeurs[produit.id] ?? '')
                                    : habituelAffiche(produit)
                              }
                              onChange={(v) =>
                                parPlateau !== null
                                  ? definirPlateaux(produit, parPlateau, v)
                                  : auPoids
                                    ? saisie.definir(produit.id, v)
                                    : definirHabituel(produit, v)
                              }
                              suffixe={parPlateau !== null ? 'plateaux' : undefined}
                              signalements={
                                refus ? (
                                  <SignalementsLigne
                                    signalements={[refus]}
                                    onEffacer={() => saisie.definir(produit.id, '')}
                                  />
                                ) : undefined
                              }
                              suggestion={
                                auPoids
                                  ? null
                                  : parPlateau !== null
                                    ? suggestionPlateaux
                                    : (repere?.moyenneProduite ?? null)
                              }
                              onAppliquerSuggestion={
                                parPlateau !== null
                                  ? suggestionPlateaux != null
                                    ? () => definirPlateaux(produit, parPlateau, String(suggestionPlateaux))
                                    : undefined
                                  : repere?.moyenneProduite != null
                                    ? () => (auPoids ? saisie.definir(produit.id, String(repere.moyenneProduite)) : definirHabituel(produit, String(repere.moyenneProduite)))
                                    : undefined
                              }
                              indice={
                                reste != null || commandeAuto > 0 || parPlateau !== null || repere?.dernier?.produite != null ? (
                                  <>
                                    {reste != null ? (
                                      <span className="chiffres text-sm font-semibold text-ink">
                                        Reste {formatDateCourt(restes.jour).split(' ').slice(0, 2).join(' ')} : {afficher(produit, reste)}
                                        {commandeAuto > 0 || parPlateau !== null || repere?.dernier?.produite != null ? ' · ' : ''}
                                      </span>
                                    ) : null}
                                    {parPlateau !== null && facultatif > 0 && partCommandee(produit.id) < plusAuto + facultatif ? (
                                      <span className="chiffres font-medium text-accent">
                                        {facultatif} en commande, pas ajouté{facultatif > 1 ? 's' : ''}{' '}
                                        <button
                                          type="button"
                                          onClick={() => ajusterCommande(produit.id, String(partCommandee(produit.id) + facultatif))}
                                          className="min-h-11 rounded-lg bg-accent-doux px-2 font-semibold underline underline-offset-2"
                                        >
                                          Ajouter {facultatif}
                                        </button>
                                        {' · '}
                                      </span>
                                    ) : null}
                                    {commandeAuto > 0 ? (
                                      <span className="chiffres font-medium text-accent">
                                        + {commandeAuto} commandé{commandeAuto > 1 ? 's' : ''} dans l&apos;application
                                        {derives !== '' ? ` (${derives})` : ''}
                                        {partCommandee(produit.id) > 0 ? ` → ${lireEntier(saisie.valeurs[produit.id] ?? '')} à produire` : ''}
                                        {parPlateau !== null || repere?.dernier?.produite != null ? ' · ' : ''}
                                      </span>
                                    ) : null}
                                    {parPlateau !== null ? (
                                      <span className={resteAncien > 0 ? 'text-attention' : ''}>
                                        {resteAncien > 0
                                          ? `ancienne demande : ${formaterPlateaux(baseHorsCommande, parPlateau)} — retapez en plateaux`
                                          : `1 plateau = ${parPlateau} pièces`}
                                        {repere?.dernier?.produite != null ? ' · ' : ''}
                                      </span>
                                    ) : null}
                                    {repere?.dernier?.produite != null ? (
                                  <>
                                    semaine passée :{' '}
                                    <span className="chiffres">
                                      {auPoids
                                        ? afficher(produit, repere.dernier.produite)
                                        : `${repere.dernier.produite} produits`}
                                    </span>
                                    {repere.dernier.restante != null ? (
                                      <>
                                        ,{' '}
                                        <span
                                          className={`chiffres ${
                                            repere.dernier.restante > repere.dernier.produite * 0.2
                                              ? 'text-attention'
                                              : ''
                                          }`}
                                        >
                                          {afficher(produit, repere.dernier.restante)} invendus
                                        </span>
                                      </>
                                    ) : null}
                                    {repere.ruptureMoyenneMinutes != null ? (
                                      <>
                                        {' · '}
                                        <span className="text-alerte">
                                          à sec vers {formatHeure(repere.ruptureMoyenneMinutes)}
                                          {repere.joursEnRupture > 1
                                            ? ` (${repere.joursEnRupture}× sur ${repere.echantillon})`
                                            : ''}
                                        </span>
                                      </>
                                    ) : null}
                                  </>
                                    ) : null}
                                  </>
                                ) : null
                              }
                              complement={
                                auPoids
                                  ? undefined
                                  : {
                                      titre: `${produit.nom} : part due à une commande`,
                                      valeur: commande.valeurs[produit.id] ?? '',
                                      onChange: (v) => ajusterCommande(produit.id, v),
                                    }
                              }
                            />
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </Carte>
              );
            })}
          </div>
        )}

        {oublisProbables.length > 0 && !saisie.chargement ? (
          <div className="mt-4">
            <Alerte ton="attention">
              <span className="font-medium">
                {oublisProbables.length} viennoiserie{oublisProbables.length > 1 ? 's' : ''}{' '}
                habituellement produite{oublisProbables.length > 1 ? 's' : ''} sans quantité :
              </span>{' '}
              {oublisProbables
                .slice(0, 6)
                .map((p) => p.nom)
                .join(', ')}
              {oublisProbables.length > 6 ? ` et ${oublisProbables.length - 6} autre(s)` : ''}.
            </Alerte>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <span className="text-xs text-ink-3 text-pretty">
            La saisie part toute seule — le fournil la voit dans la minute.
          </span>
          <Bouton
            variante="principal"
            onClick={() => void saisie.enregistrerMaintenant()}
            disabled={saisie.nbEnAttente === 0 || saisie.statut === 'envoi'}
          >
            {saisie.statut === 'envoi' ? 'Enregistrement…' : 'Enregistrer maintenant'}
          </Bouton>
        </div>
      </DispositionAvecPave>
    </div>
  );
}
