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
import { Alerte, Bouton, Puce } from '@/components/ui';
import { DESTINATIONS, dessinerTicket, type Destination } from '@/lib/ticketCanvas';
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

const LIBELLE_STATUT: Record<string, string> = {
  en_attente: 'en file',
  remis: 'en train d’imprimer',
  imprime: 'sorti',
};

/** Nom d'un bon à l'écran, sans capitales criées (les capitales restent sur le papier). */
const NOM_BON: Record<string, string> = { CLIENT: 'Client', BUREAU: 'Bureau', MAGASIN: 'Magasin', ATELIER: 'Atelier' };
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
  apresImpression,
  pendantImpression,
}: {
  commande: Commande;
  onImprime?: () => void;
  /** Boutons de la suite (« Nouvelle commande », « Accueil »…), montrés dès le dépôt dans la file. */
  apresImpression?: ReactNode;
  /** Une chose utile à faire pendant que ça sort (copier la confirmation…). */
  pendantImpression?: ReactNode;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
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

  // Le dessin se fait une fois, à l'affichage. Les canvas sont insérés tels
  // quels dans la page : aucune conversion, donc aucune occasion de diverger.
  useEffect(() => {
    const hote = conteneur.current;
    if (!hote) return;
    hote.replaceChildren();
    for (const destination of DESTINATIONS) {
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
    const preparation = encoderTickets(canvases);
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
  }, [commande]);

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

  const envoyer = async () => {
    const hote = conteneur.current;
    if (!hote || envoiEnVol.current) return;
    envoiEnVol.current = true;
    setEnvoi(true);
    setErreur(null);
    // Le retour est immédiat : les 4 tickets apparaissent « en file » dès le
    // toucher, pendant que les images se préparent et partent.
    setTravaux(enFile());
    setVuEnDirect(true);
    lotRef.current = null;
    vusRef.current = new Set();
    setLot(null);
    try {
      // Déjà prêtes le plus souvent ; sinon (préparation échouée) on refait.
      const tickets = await (ticketsPrets.current ?? Promise.reject(new Error())).catch(() =>
        encoderTickets(Array.from(hote.querySelectorAll('canvas'))),
      );
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
      setTravaux(enFile());
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
  // Dès que les tickets sont dans la file, la suite est proposée : rien à
  // attendre devant l'écran, ils sortent tout seuls.
  const deposes = vuEnDirect && travaux.length > 0 && !envoi && !bloque;
  const clientSorti = travaux.some((t) => t.destination === 'CLIENT' && t.statut === 'imprime');
  const remplissage = envoi ? 0.04 : progression(travaux, dernierProgres, horloge);
  const lotAffiche = useMemo<LotImprime | null>(() => {
    if (!lot) return null;
    const tickets = lot.destinations.map((d) => papiers[d]).filter((t): t is Papier => !!t);
    return tickets.length ? { cle: lot.cle, tickets, debut: lot.debut, dureeMs: lot.dureeMs, fini: lot.fini } : null;
  }, [lot, papiers]);

  return (
    // Centré (22/10/2026) : bouton, état d'impression et tickets dans une colonne au milieu.
    <div className="ecran-seulement mx-auto flex max-w-xl flex-col items-center">
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        <Bouton
          variante={(tousSortis || enCours) && !envoi && !bloque ? 'secondaire' : 'principal'}
          disabled={verrouille}
          aria-busy={verrouille}
          className="min-h-14 px-6 text-base"
          onClick={() => void envoyer()}
        >
          {envoi ? (
            <>
              <Rouet /> Envoi en cours…
            </>
          ) : enCours && !bloque ? (
            <>
              <Rouet /> Impression en cours… {sortis}/{travaux.length}
            </>
          ) : bloque ? (
            'Relancer l’impression'
          ) : tousSortis ? (
            'Réimprimer'
          ) : (
            'Envoyer à l’imprimante'
          )}
        </Bouton>
        <Puce ton={enLigne ? 'ok' : 'attention'}>
          {imprimante
            ? enLigne
              ? 'Imprimante en ligne'
              : `Imprimante injoignable depuis ${depuis(imprimante.vueLe)}`
            : 'Imprimante pas encore branchée'}
        </Puce>
      </div>

      {erreur ? <div className="mb-4"><Alerte>{erreur}</Alerte></div> : null}

      {travaux.length > 0 && vuEnDirect ? (
        <div
          role="status"
          aria-live="polite"
          className={`mb-4 w-full max-w-md rounded-xl border p-4 ${tousSortis ? 'border-ok/40 bg-ok-doux' : 'border-accent/40 bg-accent-doux'}`}
        >
          <ImprimanteTicket
            etat={envoi ? 'envoi' : tousSortis ? 'fini' : bloque ? 'bloque' : 'impression'}
            libelle={
              envoi
                ? 'Préparation…'
                : tousSortis
                  ? 'Tout est sorti'
                  : bloque
                    ? 'Vérifiez le papier'
                    : travaux.find((t) => t.statut === 'remis')
                      ? `Imprime : bon ${nomBon(travaux.find((t) => t.statut === 'remis')?.destination ?? '')}`
                      : 'En file'
            }
            sortis={sortis}
            total={travaux.length}
            lot={lotAffiche}
          />
          {/* Une barre qui ne s'arrête jamais : entre deux étapes réelles, elle
              avance doucement vers la suivante sans jamais la dépasser. */}
          {!bloque ? (
            <div className="mx-auto mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-black/10">
              <div
                className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${tousSortis ? 'bg-ok' : 'bg-accent'}`}
                style={{ width: `${Math.round(remplissage * 100)}%` }}
              />
            </div>
          ) : null}
          <div className="mt-3 text-center">
            <div>
              <p className="text-base font-semibold text-ink">
                {tousSortis
                  ? `✓ Les ${travaux.length} bons sont sortis`
                  : bloque
                    ? 'L’impression n’avance plus'
                    : envoi || sortis === 0
                      ? '✓ Envoyé à l’imprimante'
                      : clientSorti
                        ? '✓ Bon du client sorti — vous pouvez le lui donner'
                        : `Ça imprime — ${sortis} sur ${travaux.length} sortis`}
              </p>
              {envoi ? (
                <p className="mt-0.5 text-sm text-ink-2">Préparation des bons…</p>
              ) : !tousSortis && !bloque ? (
                <p className="mt-0.5 text-sm text-ink-2">
                  Vous pouvez passer à la suite&nbsp;: les bons sortent tout seuls, un voyant en bas de
                  l’écran suit l’impression.
                </p>
              ) : null}
            </div>
          </div>
          {bloque ? (
            <p className="mt-0.5 text-sm text-ink-2">
              Vérifiez le papier et le capot de l’imprimante, puis touchez «&nbsp;Relancer l’impression&nbsp;».
            </p>
          ) : null}
          {deposes && !tousSortis && pendantImpression ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-ink-2">
              <span>Pendant ce temps&nbsp;:</span>
              {pendantImpression}
            </div>
          ) : null}
          {deposes && apresImpression ? (
            <div className="mt-3 flex flex-wrap justify-center gap-2">{apresImpression}</div>
          ) : null}
          <ul className="mt-3 space-y-1.5 text-sm">
            {travaux.map((travail) => (
              <li key={travail.id} className="flex items-center gap-2">
                <span aria-hidden className="w-5 text-center">
                  {travail.statut === 'imprime' ? '✓' : travail.statut === 'remis' ? '⟳' : '·'}
                </span>
                <span className="w-24 font-medium text-ink">{nomBon(travail.destination)}</span>
                <span className={travail.statut === 'imprime' ? 'text-ok' : 'text-ink-2'}>
                  {LIBELLE_STATUT[travail.statut] ?? 'en file'}
                  {/* Le code renvoyé par l'imprimante reste au journal, jamais à l'écran (LOI 9). */}
                  {travail.erreur && travail.statut !== 'imprime' ? ' — repart après un incident' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {probleme ? (
        <div className="mb-4">
          <Alerte ton="attention">
            L’imprimante signale un problème. Le plus souvent&nbsp;: plus de papier, ou le capot est
            resté ouvert. Les bons restent en file et sortiront tout seuls une fois réglé.
          </Alerte>
        </div>
      ) : null}

      {!imprimante ? (
        <div className="mb-4">
          <Alerte ton="attention">
            L’imprimante n’est pas encore branchée à l’application. Vérifiez qu’elle est allumée
            et reliée au réseau du magasin&nbsp;; si cela continue, prévenez le manager.
          </Alerte>
        </div>
      ) : null}

      <p className="mb-4 max-w-prose text-center text-sm text-ink-2">
        Ci-dessous, les bons tels qu’ils sortiront de l’imprimante. Le premier sort en quelques
        secondes, les suivants s’enchaînent.
      </p>

      <div ref={conteneur} className="rouleau-apercu" />

      <style>{`
        .rouleau-apercu { display: flex; flex-direction: column; align-items: center; gap: 18px; }
        .ticket-apercu { background: #fff; box-shadow: 0 2px 18px rgba(0,0,0,.25); image-rendering: auto; }
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
function encoderTickets(canvases: HTMLCanvasElement[]): Promise<TicketEncode[]> {
  return Promise.all(
    canvases.map(async (canvas, index) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(messagePour('ERR_BON_ILLISIBLE', {}));
      const points = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const png = await pngMonochrome(points, canvas.width, canvas.height, zlibNavigateur);
      return { destination: DESTINATIONS[index] as Destination, png: enBase64(png), hauteur: canvas.height };
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

/** Les 4 exemplaires « en file », affichés sans attendre le premier tour de suivi. */
function enFile(): Travail[] {
  return DESTINATIONS.map((destination, index) => ({
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
