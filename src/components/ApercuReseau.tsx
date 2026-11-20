'use client';

// src/components/ApercuReseau.tsx
//
// L'aperçu et l'envoi vers l'imprimante réseau.
//
// Le point important : l'image affichée à l'écran est exactement celle qui
// part à l'imprimante. Pas une maquette HTML qui lui ressemble — le même
// canvas, le même fichier. Ce que le vendeur voit avant de cliquer est ce
// qu'il ira décrocher du rouleau.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Alerte, Bouton } from '@/components/ui';
import { destinationsDeCommande, dessinerTicket, type Destination } from '@/lib/ticketCanvas';
import { enBase64, pngMonochrome, zlibNavigateur } from '@/lib/pngMonochrome';
import type { Commande } from '@/lib/commandes';
import { suivreImpression } from '@/lib/suiviImpression';
import { ImprimanteTicket, type LotImprime } from '@/components/ImprimanteTicket';
import { apprendreVitesse, lireMsParLigne } from '@/lib/vitesseImpression';
import { messagePour } from '@/domaine/messages';
import { lireReponse } from '@/components/commande/modele';

type Travail = {
  id: number;
  destination: string;
  statut: string;
  erreur: string | null;
  imprimeLe: string | null;
};

type EtatImprimante = { statusCode: string; vueLe: string } | null;

/** Nom d'un bon à l'écran, sans capitales criées (les capitales restent sur le papier). */
const NOM_BON: Record<string, string> = {
  CLIENT: 'Client',
  BUREAU: 'Bureau',
  MAGASIN: 'Magasin',
  PATISSIER: 'Pâtissier',
  ATELIER: 'Atelier',
  BOULANGER: 'Boulanger',
};
const nomBon = (destination: string) => NOM_BON[destination] ?? destination;

/** Sans nouvelle de l'imprimante depuis ce délai, on la dit injoignable. */
const INJOIGNABLE_APRES_MS = 45_000;

/** Sans progrès pendant ce délai, on rend la main au vendeur pour relancer. */
const BLOQUE_APRES_MS = 45_000;

function Rouet() {
  return (
    <span
      aria-hidden
      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
    />
  );
}

export function ApercuReseau({
  commande,
  onImprime,
  haut,
  whatsapp,
  secours,
}: {
  commande: Commande;
  onImprime?: () => void;
  /** En-tête de l'écran (retour, titre, carte de la commande), au-dessus des colonnes. */
  haut?: ReactNode;
  /** Bouton « Copier pour WhatsApp », toujours à côté du bouton principal. */
  whatsapp?: ReactNode;
  /** Lien de secours en pied (« Imprimante en panne ? Imprimer sur papier »). */
  secours?: ReactNode;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  // R74 : les papiers de CETTE commande — client, bureau, magasin, puis un bon
  // par poste concerné (pâtissier, atelier, boulanger).
  const papiersCommande = useMemo(() => destinationsDeCommande(commande), [commande]);
  const ticketsPrets = useRef<Promise<TicketEncode[]> | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [travaux, setTravaux] = useState<Travail[]>([]);
  const [imprimante, setImprimante] = useState<EtatImprimante>(null);
  const [suivi, setSuivi] = useState(false);
  // Dernier moment où l'impression a avancé : sert à détecter un blocage.
  const [dernierProgres, setDernierProgres] = useState(0);
  const [horloge, setHorloge] = useState(0);
  // Le bandeau « ✓ sortis » ne s'affiche qu'après une impression suivie ici,
  // pas pour une commande imprimée hier qu'on rouvre.
  const [vuEnDirect, setVuEnDirect] = useState(false);
  // Les PNG noir et blanc qui partent à l'imprimante, montrés tels quels dans
  // l'imprimante animée : le papier à l'écran est le papier du rouleau.
  const [papiers, setPapiers] = useState<Partial<Record<string, Papier>>>({});
  const papiersRef = useRef<Partial<Record<string, Papier>>>({});
  // Le lot dans l'imprimante (les exemplaires pris ensemble), pour l'animation.
  const [lot, setLot] = useState<LotSuivi | null>(null);
  const lotRef = useRef<LotSuivi | null>(null);
  const vusRef = useRef(new Set<number>());
  // Le bon montré dans l'aperçu : celui qu'on touche dans la liste ; pendant
  // l'impression, celui qui sort.
  const [choix, setChoix] = useState<Destination | null>(null);

  // Le dessin se fait une fois, à l'affichage. Les canvas sont insérés tels
  // quels dans la page : aucune conversion, donc aucune occasion de diverger.
  useEffect(() => {
    const hote = conteneur.current;
    if (!hote) return;
    hote.replaceChildren();
    for (const destination of papiersCommande) {
      const canvas = dessinerTicket(destination, commande);
      canvas.className = 'ticket-apercu';
      // 80 mm à l'écran, quelle que soit la densité de l'écran.
      canvas.style.width = '302px';
      canvas.style.height = 'auto';
      hote.appendChild(canvas);
    }
    // Les images partent prêtes : on les encode dès l'affichage, pendant que le
    // vendeur relit l'aperçu, pour que le toucher « Envoyer » parte aussitôt.
    const canvases = Array.from(hote.querySelectorAll('canvas'));
    const preparation = encoderTickets(canvases, papiersCommande);
    preparation
      .then((tickets) => {
        const tous = Object.fromEntries(
          tickets.map((t) => [t.destination, { image: `data:image/png;base64,${t.png}`, hauteur: t.hauteur }]),
        );
        papiersRef.current = tous;
        setPapiers(tous);
      })
      .catch(() => undefined);
    ticketsPrets.current = preparation;
  }, [commande, papiersCommande]);

  const rafraichir = useCallback(async () => {
    try {
      const reponse = await fetch(`/api/impression?commandeId=${commande.id}`, { cache: 'no-store' });
      const donnees = await reponse.json();
      setImprimante(donnees.imprimante ?? null);
      setTravaux(Array.isArray(donnees.travaux) ? donnees.travaux : []);
      return Array.isArray(donnees.travaux) ? (donnees.travaux as Travail[]) : [];
    } catch {
      return [];
    }
  }, [commande.id]);

  // À l'ouverture : si des tickets de cette commande sont encore en route
  // (envoyés depuis une autre tablette, ou page rechargée), on les suit.
  useEffect(() => {
    void rafraichir().then((liste) => {
      if (liste.some((t) => t.statut !== 'imprime')) {
        setDernierProgres(Date.now());
        setVuEnDirect(true);
        setSuivi(true);
      }
    });
  }, [rafraichir]);

  // Ce que l'imprimante a pris ensemble forme un lot ; sa sortie complète est
  // chronométrée pour apprendre la vitesse réelle de l'imprimante.
  const suivreLot = useCallback((liste: Travail[]) => {
    const maintenant = Date.now();
    let courant = lotRef.current;
    if (courant && !courant.fini && courant.ids.every((id) => liste.find((t) => t.id === id)?.statut === 'imprime')) {
      apprendreVitesse(maintenant - courant.debut, courant.lignes);
      courant = { ...courant, fini: true };
    }
    const remis = liste.filter((t) => t.statut === 'remis' && !vusRef.current.has(t.id));
    // Sortis sans qu'on les ait vus partir (impression plus rapide qu'un tour) : on les montre quand même.
    const surpris = liste.filter((t) => t.statut === 'imprime' && !vusRef.current.has(t.id));
    const nouveaux = remis.length ? remis : (!courant || courant.fini) && surpris.length ? surpris : [];
    if (nouveaux.length) {
      for (const t of nouveaux) vusRef.current.add(t.id);
      const lignes = nouveaux.reduce((n, t) => n + (papiersRef.current[t.destination]?.hauteur ?? LIGNES_PAR_DEFAUT), 0);
      courant = {
        cle: nouveaux.map((t) => t.id).join(','),
        ids: nouveaux.map((t) => t.id),
        destinations: nouveaux.map((t) => t.destination),
        lignes,
        debut: maintenant,
        dureeMs: lignes * lireMsParLigne(),
        fini: !remis.length,
      };
    }
    if (courant !== lotRef.current) {
      lotRef.current = courant;
      setLot(courant);
    }
  }, []);

  // Tant que tout n'est pas sorti, on regarde souvent : l'animation se cale sur
  // le moment où l'imprimante prend les tickets et sur celui où elle confirme.
  // Une fois terminé, on arrête : la tablette reste allumée toute la journée.
  useEffect(() => {
    if (!suivi) return;
    let avancementAvant = -1;
    const minuteur = setInterval(async () => {
      const liste = await rafraichir();
      suivreLot(liste);
      // en file → en train d'imprimer → sorti : chaque pas compte comme un progrès.
      const avancement = liste.reduce((n, t) => n + (t.statut === 'imprime' ? 2 : t.statut === 'remis' ? 1 : 0), 0);
      if (avancement !== avancementAvant) {
        if (avancementAvant !== -1) setDernierProgres(Date.now());
        avancementAvant = avancement;
      }
      setHorloge(Date.now());
      if (liste.length && liste.every((t) => t.statut === 'imprime')) {
        setSuivi(false);
        onImprime?.();
      }
    }, 600);
    return () => clearInterval(minuteur);
  }, [suivi, rafraichir, onImprime, suivreLot]);

  // Un double toucher rapide arrive avant que le bouton soit désactivé à l'écran.
  const envoiEnVol = useRef(false);

  /**
   * Sans argument : tous les papiers de la commande. Avec `choix` : seulement
   * ceux-là, un papier pouvant y figurer deux fois (deux exemplaires).
   */
  const envoyer = async (choix?: Destination[]) => {
    const hote = conteneur.current;
    if (!hote || envoiEnVol.current) return;
    const aSortir = choix ?? papiersCommande;
    envoiEnVol.current = true;
    setEnvoi(true);
    setErreur(null);
    // Le retour est immédiat : les tickets apparaissent « en file » dès le
    // toucher, pendant que les images se préparent et partent.
    setTravaux(enFile(aSortir));
    setVuEnDirect(true);
    lotRef.current = null;
    vusRef.current = new Set();
    setLot(null);
    try {
      // Déjà prêtes le plus souvent ; sinon (préparation échouée) on refait.
      const prets = await (ticketsPrets.current ?? Promise.reject(new Error())).catch(() =>
        encoderTickets(Array.from(hote.querySelectorAll('canvas')), papiersCommande),
      );
      const tickets = aSortir.flatMap((d) => prets.filter((t) => t.destination === d));
      if (tickets.length !== aSortir.length) throw new Error(messagePour('ERR_BON_ILLISIBLE', {}));
      let reponse: Response;
      try {
        reponse = await fetch('/api/impression', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commandeId: commande.id, numero: commande.numero, tickets }),
        });
      } catch {
        // Réseau coupé : jamais « Failed to fetch » (LOI 9). La commande, elle, est enregistrée.
        throw new Error(messagePour('ERR_IMPRESSION_NON_ENVOYEE', {}));
      }
      if (!reponse.ok) {
        // Refus typé du catalogue (bons illisibles, base injoignable…), lu par le lecteur commun.
        const r = await lireReponse(reponse);
        throw new Error(r.ok ? messagePour('ERR_BON_ILLISIBLE', {}) : r.message);
      }
      // Déposés : le vendeur peut partir, le voyant en bas d'écran prend le relais.
      suivreImpression(commande.id, commande.numero);
      setTravaux(enFile(aSortir));
      setDernierProgres(Date.now());
      setVuEnDirect(true);
      setSuivi(true);
      void rafraichir();
    } catch (e) {
      // Seuls des messages du catalogue arrivent ici (ci-dessus et encoderTickets).
      setErreur(e instanceof Error && e.message ? e.message : messagePour('ERR_IMPRESSION_NON_ENVOYEE', {}));
      setVuEnDirect(false);
      void rafraichir();
    } finally {
      envoiEnVol.current = false;
      setEnvoi(false);
    }
  };

  const enLigne = imprimante ? Date.now() - Date.parse(imprimante.vueLe) < INJOIGNABLE_APRES_MS : false;
  const probleme = imprimante && imprimante.statusCode && !/^200/.test(imprimante.statusCode);
  const tousSortis = travaux.length > 0 && travaux.every((t) => t.statut === 'imprime');
  const sortis = travaux.filter((t) => t.statut === 'imprime').length;
  const enCours = suivi && !tousSortis;
  // Bloqué : rien n'a bougé depuis un moment. On rend le bouton pour relancer.
  const bloque = enCours && dernierProgres > 0 && Date.now() - dernierProgres > BLOQUE_APRES_MS;
  const verrouille = envoi || (enCours && !bloque);
  const clientSorti = travaux.some((t) => t.destination === 'CLIENT' && t.statut === 'imprime');
  const remplissage = envoi ? 0.04 : progression(travaux, dernierProgres, horloge);
  const lotAffiche = useMemo<LotImprime | null>(() => {
    if (!lot) return null;
    const tickets = lot.destinations.map((d) => papiers[d]).filter((t): t is Papier => !!t);
    return tickets.length ? { cle: lot.cle, tickets, debut: lot.debut, dureeMs: lot.dureeMs, fini: lot.fini } : null;
  }, [lot, papiers]);

  // L'aperçu : le bon touché dans la liste, ou celui qui est en train de sortir.
  const enSortie = lot && !lot.fini ? (lot.destinations[0] as Destination) : null;
  const selection: Destination =
    enSortie && papiersCommande.includes(enSortie)
      ? enSortie
      : choix && papiersCommande.includes(choix)
        ? choix
        : papiersCommande[0];

  // Un seul canvas visible à la fois ; tous restent dans la page (l'encodage les lit tous).
  useEffect(() => {
    const hote = conteneur.current;
    if (!hote) return;
    Array.from(hote.querySelectorAll('canvas')).forEach((canvas, i) => {
      canvas.style.display = papiersCommande[i] === selection ? '' : 'none';
    });
  }, [selection, papiersCommande, commande]);

  /** L'état d'un bon dans la liste. */
  const etatDuPapier = (destination: Destination): { libelle: string; classe: string } => {
    const t = travaux.filter((x) => x.destination === destination);
    if (t.length === 0) {
      return vuEnDirect && travaux.length > 0
        ? { libelle: '—', classe: 'text-ink-3' }
        : { libelle: 'en attente', classe: 'text-ink-3' };
    }
    if (t.every((x) => x.statut === 'imprime')) return { libelle: '✓ sorti', classe: 'font-semibold text-ok' };
    if (t.some((x) => x.statut === 'remis')) return { libelle: 'en cours', classe: 'font-semibold text-accent' };
    return { libelle: 'en file', classe: 'text-ink-2' };
  };

  const nombreBons = papiersCommande.length;
  const enImpression = travaux.find((t) => t.statut === 'remis');
  const libelleMachine = envoi
    ? 'Préparation…'
    : tousSortis
      ? 'Tout est sorti'
      : bloque
        ? 'Vérifiez le papier'
        : enImpression
          ? `Imprime : bon ${nomBon(enImpression.destination)}`
          : 'En file';

  return (
    // Écran d'impression façon iOS (propriétaire, 20/11/2026) : la commande en
    // résumé, la liste des bons avec leur état, l'aperçu du bon touché, et UN
    // gros bouton en bas.
    <div className="ecran-seulement mx-auto max-w-4xl px-4 pb-44">
      {haut}

      {erreur ? (
        <div className="mb-4">
          <Alerte>{erreur}</Alerte>
        </div>
      ) : null}
      {probleme ? (
        <div className="mb-4">
          <Alerte ton="attention">
            L’imprimante signale un problème. Le plus souvent&nbsp;: plus de papier, ou le capot est resté
            ouvert. Les bons restent en file et sortiront tout seuls une fois réglé.
          </Alerte>
        </div>
      ) : null}
      {!imprimante ? (
        <div className="mb-4">
          <Alerte ton="attention">
            L’imprimante n’est pas encore branchée à l’application. Vérifiez qu’elle est allumée et reliée au
            réseau du magasin&nbsp;; si cela continue, prévenez le manager. En attendant, «&nbsp;Imprimer sur
            papier&nbsp;» en bas de l’écran.
          </Alerte>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div className="grid gap-4">
          <section aria-label="Les bons">
            <h2 className="mb-1.5 px-4 text-sm text-ink-2">
              {tousSortis
                ? `${nombreBons} ${nombreBons > 1 ? 'bons sortis' : 'bon sorti'}`
                : enCours
                  ? 'Impression en cours'
                  : `${nombreBons} ${nombreBons > 1 ? 'bons' : 'bon'} · touchez un bon pour le voir`}
            </h2>
            <ul className="overflow-hidden rounded-2xl bg-surface">
              {papiersCommande.map((destination, rang) => {
                const etat = etatDuPapier(destination);
                const actif = destination === selection;
                return (
                  <li key={destination} className={rang > 0 ? 'border-t border-line' : ''}>
                    <button
                      type="button"
                      aria-pressed={actif}
                      onClick={() => setChoix(destination)}
                      className={`flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left text-base ${
                        actif ? 'bg-accent-doux' : ''
                      }`}
                    >
                      <span className="font-medium text-ink">{nomBon(destination)}</span>
                      <span className={`flex items-center gap-1.5 text-sm ${etat.classe}`}>
                        {etat.libelle}
                        <span aria-hidden className="text-ink-3">
                          ›
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 px-4 text-sm text-ink-2">
              <span
                aria-hidden
                className={`mr-1.5 inline-block h-2 w-2 rounded-full ${enLigne ? 'bg-ok' : 'bg-attention'}`}
              />
              {imprimante
                ? enLigne
                  ? 'Imprimante Star en ligne'
                  : `Imprimante injoignable depuis ${depuis(imprimante.vueLe)}`
                : 'Imprimante pas encore branchée'}
            </p>
          </section>

          {travaux.length > 0 && vuEnDirect ? (
            <div role="status" aria-live="polite" className={`rounded-2xl p-4 ${tousSortis ? 'bg-ok-doux' : 'bg-surface'}`}>
              <ImprimanteTicket
                etat={envoi ? 'envoi' : tousSortis ? 'fini' : bloque ? 'bloque' : 'impression'}
                libelle={libelleMachine}
                sortis={sortis}
                total={travaux.length}
                lot={lotAffiche}
              />
              {/* Une barre qui ne s'arrête jamais : entre deux étapes réelles, elle
                  avance doucement vers la suivante sans jamais la dépasser. */}
              {!bloque ? (
                <div className="mx-auto mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-segment-fond">
                  <div
                    className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
                      tousSortis ? 'bg-ok' : 'bg-accent'
                    }`}
                    style={{ width: `${Math.round(remplissage * 100)}%` }}
                  />
                </div>
              ) : null}
              <p className="mt-3 text-center text-base font-semibold text-ink">
                {tousSortis
                  ? travaux.length === 1
                    ? '✓ Le bon est sorti'
                    : `✓ Les ${travaux.length} bons sont sortis`
                  : bloque
                    ? 'L’impression n’avance plus'
                    : envoi || sortis === 0
                      ? '✓ Envoyé à l’imprimante'
                      : clientSorti
                        ? '✓ Bon du client sorti — vous pouvez le lui donner'
                        : `Ça imprime — ${sortis} sur ${travaux.length} sortis`}
              </p>
              {bloque ? (
                <p className="mt-0.5 text-center text-sm text-ink-2">
                  Vérifiez le papier et le capot de l’imprimante, puis touchez «&nbsp;Relancer l’impression&nbsp;».
                </p>
              ) : !tousSortis ? (
                <p className="mt-0.5 text-center text-sm text-ink-2">
                  Les bons sortent tout seuls&nbsp;: un voyant en bas de l’écran suit l’impression.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* L'aperçu du bon touché : exactement le papier qui sort de l'imprimante. */}
        <section
          aria-label={`Aperçu du bon ${nomBon(selection)}`}
          className="rounded-2xl bg-surface p-4 md:sticky md:top-20"
        >
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">Bon {nomBon(selection)}</h2>
            <span className="text-sm text-ink-2">aperçu du papier</span>
          </div>
          <div ref={conteneur} className="rouleau-apercu overflow-x-auto" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Bouton
              disabled={verrouille}
              aria-label={`Imprimer 1 exemplaire du bon ${nomBon(selection)}`}
              onClick={() => void envoyer([selection])}
            >
              1 exemplaire
            </Bouton>
            <Bouton
              disabled={verrouille}
              aria-label={`Imprimer 2 exemplaires du bon ${nomBon(selection)}`}
              onClick={() => void envoyer([selection, selection])}
            >
              2 exemplaires
            </Bouton>
          </div>
        </section>
      </div>

      {/* Barre d'action collée en bas : le geste principal est toujours là. */}
      <div className="sans-impression fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-ground/90 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto max-w-4xl px-4">
          <div className="flex gap-3">
            {tousSortis && !envoi && !bloque ? (
              <Link
                href="/commandes/nouvelle"
                className="inline-flex min-h-14 flex-[1.4] items-center justify-center rounded-2xl bg-accent px-4 text-lg font-semibold text-accent-texte active:scale-[0.98]"
              >
                Nouvelle commande
              </Link>
            ) : (
              <Bouton
                variante="principal"
                disabled={verrouille}
                aria-busy={verrouille}
                className="min-h-14 flex-[1.4] rounded-2xl text-lg"
                onClick={() => void envoyer()}
              >
                {envoi ? (
                  <>
                    <Rouet /> Envoi en cours…
                  </>
                ) : enCours && !bloque ? (
                  <>
                    <Rouet /> Impression… {sortis}/{travaux.length}
                  </>
                ) : bloque ? (
                  'Relancer l’impression'
                ) : (
                  `Imprimer ${nombreBons > 1 ? `les ${nombreBons} bons` : 'le bon'}`
                )}
              </Bouton>
            )}
            {whatsapp ? (
              <div className="flex flex-1 [&>*]:min-h-14 [&>*]:w-full [&>*]:rounded-2xl [&>*]:text-base">{whatsapp}</div>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm">
            {tousSortis ? (
              <>
                <button type="button" onClick={() => void envoyer()} className="min-h-9 text-accent">
                  Réimprimer les bons
                </button>
                <Link href="/" className="inline-flex min-h-9 items-center text-ink-2">
                  Accueil
                </Link>
                <Link href="/commandes" className="inline-flex min-h-9 items-center text-ink-2">
                  Liste des commandes
                </Link>
              </>
            ) : (
              secours
            )}
          </div>
        </div>
      </div>

      <style>{`
        .rouleau-apercu { display: flex; flex-direction: column; align-items: center; gap: 18px; }
        .ticket-apercu { background: #fff; box-shadow: 0 1px 10px rgba(0,0,0,.18); image-rendering: auto; max-width: none; }
      `}</style>
    </div>
  );
}

type TicketEncode = { destination: Destination; png: string; hauteur: number };
type Papier = { image: string; hauteur: number };
type LotSuivi = {
  cle: string;
  ids: number[];
  destinations: string[];
  lignes: number;
  debut: number;
  dureeMs: number;
  fini: boolean;
};

/** Longueur supposée d'un ticket dont on n'a pas l'image (page rouverte pendant l'impression). */
const LIGNES_PAR_DEFAUT = 1000;

/**
 * PNG noir et blanc 1 bit, pas toDataURL (couleur 32 bits) : décodé, un long
 * ticket en couleur dépasse la mémoire de l'imprimante (« 511 Media Decoding
 * Error », voir src/lib/pngMonochrome.ts).
 */
function encoderTickets(canvases: HTMLCanvasElement[], papiers: readonly Destination[]): Promise<TicketEncode[]> {
  return Promise.all(
    canvases.map(async (canvas, index) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(messagePour('ERR_BON_ILLISIBLE', {}));
      const points = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const png = await pngMonochrome(points, canvas.width, canvas.height, zlibNavigateur);
      return { destination: papiers[index], png: enBase64(png), hauteur: canvas.height };
    }),
  );
}

/**
 * Remplissage de la barre, de 0 à 1. Chaque ticket compte deux étapes réelles
 * (pris par l'imprimante, puis sorti). Entre deux étapes, la barre glisse vers
 * la suivante (jusqu'à 85 % de l'écart, en ralentissant) : elle ne reste
 * jamais figée, et ne promet jamais plus que ce qui est vraiment sorti.
 */
function progression(travaux: Travail[], dernierProgres: number, maintenant: number): number {
  if (!travaux.length) return 0;
  const etapes = travaux.length * 2;
  const faites = travaux.reduce((n, t) => n + (t.statut === 'imprime' ? 2 : t.statut === 'remis' ? 1 : 0), 0);
  if (faites >= etapes) return 1;
  const ecoule = dernierProgres > 0 && maintenant > dernierProgres ? maintenant - dernierProgres : 0;
  const glisse = 0.85 * (1 - Math.exp(-ecoule / 3000));
  return Math.max(0.04, (faites + glisse) / etapes);
}

/** Les papiers envoyés, « en file », affichés sans attendre le premier tour de suivi. */
function enFile(papiers: readonly Destination[]): Travail[] {
  return papiers.map((destination, index) => ({
    id: -1 - index,
    destination,
    statut: 'en_attente',
    erreur: null,
    imprimeLe: null,
  }));
}

function depuis(iso: string): string {
  const secondes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  // Espace insécable : « 3 min » ne se coupe jamais en fin de ligne.
  if (secondes < 120) return `${secondes}\u00A0s`;
  const minutes = Math.round(secondes / 60);
  if (minutes < 120) return `${minutes}\u00A0min`;
  const heures = Math.round(minutes / 60);
  if (heures < 48) return `${heures}\u00A0h`;
  return `${Math.round(heures / 24)}\u00A0jours`;
}
