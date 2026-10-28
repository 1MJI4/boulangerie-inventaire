'use client';

// src/components/ApercuReseau.tsx
//
// L'aperçu et l'envoi vers l'imprimante réseau.
//
// Le point important : l'image affichée à l'écran est exactement celle qui
// part à l'imprimante. Pas une maquette HTML qui lui ressemble — le même
// canvas, le même fichier. Ce que le vendeur voit avant de cliquer est ce
// qu'il ira décrocher du rouleau.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alerte, Bouton, Puce } from '@/components/ui';
import { DESTINATIONS, dessinerTicket, type Destination } from '@/lib/ticketCanvas';
import { enBase64, pngMonochrome, zlibNavigateur } from '@/lib/pngMonochrome';
import type { Commande } from '@/lib/commandes';
import { suivreImpression } from '@/lib/suiviImpression';
import { ImprimanteTicket, SORTIE_TICKET_MS } from '@/components/ImprimanteTicket';

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
  const [papiers, setPapiers] = useState<Partial<Record<string, string>>>({});

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
      .then((tickets) =>
        setPapiers(Object.fromEntries(tickets.map((t) => [t.destination, `data:image/png;base64,${t.png}`]))),
      )
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

  // Tant que tout n'est pas sorti, on regarde chaque seconde (un ticket sort
  // en quelques secondes : à 2 s l'écran paraissait en retard sur le papier).
  // Une fois terminé, on arrête : la tablette reste allumée toute la journée.
  useEffect(() => {
    if (!suivi) return;
    let avancementAvant = -1;
    const minuteur = setInterval(async () => {
      const liste = await rafraichir();
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
    }, 1000);
    return () => clearInterval(minuteur);
  }, [suivi, rafraichir, onImprime]);

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
    try {
      // Déjà prêtes le plus souvent ; sinon (préparation échouée) on refait.
      const tickets = await (ticketsPrets.current ?? Promise.reject(new Error())).catch(() =>
        encoderTickets(Array.from(hote.querySelectorAll('canvas'))),
      );
      const reponse = await fetch('/api/impression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandeId: commande.id, numero: commande.numero, tickets }),
      });
      if (!reponse.ok) {
        const donnees = await reponse.json().catch(() => ({}));
        throw new Error(donnees.erreur ?? 'Envoi refusé.');
      }
      // Déposés : le vendeur peut partir, le voyant en bas d'écran prend le relais.
      suivreImpression(commande.id, commande.numero);
      setTravaux(enFile());
      setDernierProgres(Date.now());
      setVuEnDirect(true);
      setSuivi(true);
      void rafraichir();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Envoi impossible.');
      setVuEnDirect(false);
      void rafraichir();
    } finally {
      envoiEnVol.current = false;
      setEnvoi(false);
    }
  };

  const enLigne = imprimante ? Date.now() - Date.parse(imprimante.vueLe) < 45_000 : false;
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
  const papier = papierSousLaFente(travaux, papiers, tousSortis, dernierProgres, horloge);

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
              : `Imprimante silencieuse depuis ${depuis(imprimante.vueLe)}`
            : 'Imprimante jamais vue'}
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
                      ? `Imprime : ${travaux.find((t) => t.statut === 'remis')?.destination}`
                      : 'En file'
            }
            sortis={sortis}
            total={travaux.length}
            ticket={papier}
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
                  ? `✓ Les ${travaux.length} tickets sont sortis`
                  : bloque
                    ? 'L’impression n’avance plus'
                    : envoi || sortis === 0
                      ? '✓ Envoyé à l’imprimante'
                      : clientSorti
                        ? '✓ Ticket client sorti — vous pouvez le donner'
                        : `Ça imprime — ${sortis} sur ${travaux.length} sortis`}
              </p>
              {envoi ? (
                <p className="mt-0.5 text-sm text-ink-2">Préparation des tickets…</p>
              ) : !tousSortis && !bloque ? (
                <p className="mt-0.5 text-sm text-ink-2">
                  Vous pouvez passer à la suite : les tickets sortent tout seuls, un voyant en bas de
                  l’écran suit l’impression.
                </p>
              ) : null}
            </div>
          </div>
          {bloque ? (
            <p className="mt-0.5 text-sm text-ink-2">
              Vérifiez le papier et le capot de l’imprimante, puis touchez « Relancer l’impression ».
            </p>
          ) : null}
          {deposes && !tousSortis && pendantImpression ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-ink-2">
              <span>Pendant ce temps :</span>
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
                <span className="w-24 font-medium text-ink">{travail.destination}</span>
                <span className={travail.statut === 'imprime' ? 'text-ok' : 'text-ink-2'}>
                  {LIBELLE_STATUT[travail.statut] ?? travail.statut}
                  {travail.erreur ? ` (${travail.erreur})` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {probleme ? (
        <div className="mb-4">
          <Alerte>
            L’imprimante signale un problème (code {imprimante?.statusCode}). Le plus souvent :
            plus de papier, ou le capot est resté ouvert. Les tickets restent en file et sortiront
            tout seuls une fois le rouleau remis.
          </Alerte>
        </div>
      ) : null}

      {!imprimante ? (
        <div className="mb-4">
          <Alerte>
            L’imprimante ne s’est encore jamais manifestée. Vérifiez qu’elle est allumée, sur le
            réseau, et que l’URL CloudPRNT est bien renseignée dans ses réglages.
          </Alerte>
        </div>
      ) : null}

      <p className="mb-4 max-w-prose text-center text-sm text-ink-2">
        Ce que vous voyez ci-dessous est l’image exacte envoyée à l’imprimante — même largeur, mêmes
        points. Le premier ticket sort en quelques secondes, les suivants s’enchaînent.
      </p>

      <div ref={conteneur} className="rouleau-apercu" />

      <style>{`
        .rouleau-apercu { display: flex; flex-direction: column; align-items: center; gap: 18px; }
        .ticket-apercu { background: #fff; box-shadow: 0 2px 18px rgba(0,0,0,.25); image-rendering: auto; }
      `}</style>
    </div>
  );
}

type TicketEncode = { destination: Destination; png: string };

/**
 * PNG noir et blanc 1 bit, pas toDataURL (couleur 32 bits) : décodé, un long
 * ticket en couleur dépasse la mémoire de l'imprimante (« 511 Media Decoding
 * Error », voir src/lib/pngMonochrome.ts).
 */
function encoderTickets(canvases: HTMLCanvasElement[]): Promise<TicketEncode[]> {
  return Promise.all(
    canvases.map(async (canvas, index) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Ticket illisible : rechargez la page.');
      const points = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const png = await pngMonochrome(points, canvas.width, canvas.height, zlibNavigateur);
      return { destination: DESTINATIONS[index] as Destination, png: enBase64(png) };
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

/**
 * Le ticket qui dépasse de la fente. Celui que l'imprimante a pris sort en
 * s'animant ; pris à plusieurs (envoi groupé), ils sortent l'un après l'autre
 * au rythme de l'animation. Entre deux, le dernier sorti reste posé ; à la
 * fin, c'est le ticket client qui reste visible.
 */
function papierSousLaFente(
  travaux: Travail[],
  papiers: Partial<Record<string, string>>,
  tousSortis: boolean,
  dernierProgres: number,
  maintenant: number,
): { cle: string; image: string; sort: boolean } | null {
  const montrer = (t: Travail | undefined, sort: boolean) => {
    const image = t ? papiers[t.destination] : undefined;
    return t && image ? { cle: `${t.destination}-${sort ? 'sort' : 'pose'}`, image, sort } : null;
  };
  if (tousSortis) return montrer(travaux.find((t) => t.destination === 'CLIENT') ?? travaux[0], false);
  const remis = travaux.filter((t) => t.statut === 'remis');
  if (remis.length) {
    const ecoule = dernierProgres > 0 && maintenant > dernierProgres ? maintenant - dernierProgres : 0;
    return montrer(remis[Math.min(remis.length - 1, Math.floor(ecoule / SORTIE_TICKET_MS))], true);
  }
  return montrer([...travaux].reverse().find((t) => t.statut === 'imprime'), false);
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
  if (secondes < 120) return `${secondes} s`;
  const minutes = Math.round(secondes / 60);
  if (minutes < 120) return `${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 48) return `${heures} h`;
  return `${Math.round(heures / 24)} jours`;
}
