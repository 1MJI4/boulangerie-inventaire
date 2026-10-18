'use client';

// src/app/commandes/reglages/page.tsx
//
// Réglages des commandes, réservés au gérant (code gérant, POST /api/gestion).
// Depuis le lot 2, AUCUN prix ne se règle ici : prix, minimums et formats
// viennent du catalogue de commande, mis à jour par l'import du tarif (agent
// `catalogue-prix`). Restent :
//   - LOI 11 (15/10 et 18/10/2026) : les heures d'ouverture du magasin (bornes
//     de l'heure de retrait), jour par jour et par date exceptionnelle, et les
//     tailles standard des gâteaux simples et le délai minimum d'un gâteau à
//     étages, en jours ouvrés (PUT /api/reglages) ;
//   - les mots proposés au vendeur (parfums, garnitures, décorations) ;
//   - les produits signalés au comptoir comme absents du tarif, à faire
//     ajouter au prochain import puis à « ranger ».
// Un onglet par sujet : la page ne défile pas. Tout se règle au doigt (−/+,
// pavé de l'application), jamais au clavier du système.
// Le message du serveur est affiché tel quel (jamais « Code incorrect » en dur),
// et le code est redemandé dès que l'accès gérant a expiré (403).

import { useCallback, useEffect, useState } from 'react';
import { Bouton, Carte, Chargement, Entete, Puce } from '@/components/ui';
import { ListeSignalements } from '@/components/signalement';
import { RappelChargement } from '@/components/rappels';
import { AccesGerant } from '@/components/commande/AccesGerant';
import { echecReseau, lireReponse } from '@/components/commande/modele';
import { PaveEntier, SelecteurDateRetrait } from '@/components/saisie';
import { libelleLong } from '@/components/saisie/dates';
import { formaterEuros } from '@/domaine/argent';
import { fermetureDuJour, type JourFerme } from '@/domaine/calendrier';
import { heureChamp, horairesOuvertureDuJour, lireHeure } from '@/domaine/reglement';
import { JOURS_ISO_CLES, type JourIsoCle, type PlageOuverture } from '@/domaine/constantes';
import type { Echec } from '@/domaine/resultat';
import type { GenreOption, OptionGateau, OptionsGateau } from '@/lib/gateaux';

type ProduitSignale = { id: number; nom: string; prixCentimes: number };
type Exception = { date: string } & PlageOuverture;
/** GET / PUT /api/reglages. */
type Reglages = {
  parJour: Record<JourIsoCle, PlageOuverture>;
  exceptions: Exception[];
  taillesGateau: number[];
  /** Délai minimum d'un gâteau à étages, en jours ouvrés. */
  delaiGateauEtagesJours: number;
};
type Calendrier = { aujourdhui: string; joursFermes: JourFerme[]; gerant: boolean };
type Onglet = 'heures' | 'tailles' | 'mots' | 'signales';
type Envoyer = (url: string, methode: 'POST' | 'PATCH' | 'PUT', corps: Record<string, unknown>) => Promise<boolean>;

const CHAMP = 'min-h-12 rounded-xl border-2 border-line-fort bg-surface px-3 text-base text-ink placeholder:text-ink-3';
/** Pas du réglage des heures au doigt. */
const PAS_MINUTES = 30;
const DERNIERE_MINUTE = 23 * 60 + 30;

/**
 * Date de référence d'un jour ISO (semaine du lundi 1er janvier 2024), pour le
 * nom du jour (Intl) et pour savoir s'il est fermé chaque semaine (domaine).
 */
function dateReference(cle: JourIsoCle): string {
  return `2024-01-0${cle}`;
}
function nomJour(cle: JourIsoCle): string {
  const n = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${dateReference(cle)}T12:00:00Z`),
  );
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** « 12:00 » ± 30 min, borné à la journée ; null si l'heure est illisible. */
function decaler(heure: string, sens: 1 | -1): string | null {
  const m = lireHeure(heure);
  if (m === null) return null;
  return heureChamp(Math.min(DERNIERE_MINUTE, Math.max(0, m + sens * PAS_MINUTES)));
}

export default function ReglagesCommandes() {
  const [acces, setAcces] = useState<'inconnu' | 'ferme' | 'ouvert'>('inconnu');
  const [refus, setRefus] = useState<Echec | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('heures');
  const [cal, setCal] = useState<Calendrier | null>(null);
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [options, setOptions] = useState<OptionsGateau | null>(null);
  const [signales, setSignales] = useState<ProduitSignale[]>([]);

  const charger = useCallback(async () => {
    try {
      const [o, t, r] = await Promise.all([
        lireReponse<OptionsGateau>(await fetch('/api/gateaux?inclureInactifs=1')),
        lireReponse<ProduitSignale[]>(await fetch('/api/tarifs?aRanger=1')),
        lireReponse<Reglages>(await fetch('/api/reglages')),
      ]);
      if (o.ok) setOptions(o.donnees);
      else setRefus(o);
      if (t.ok) setSignales(Array.isArray(t.donnees) ? t.donnees : []);
      else setRefus(t);
      if (r.ok) setReglages(r.donnees);
      else setRefus(r);
    } catch {
      const e = echecReseau();
      if (!e.ok) setRefus(e);
    }
  }, []);

  // L'accès gérant est-il déjà ouvert sur cette tablette ? (+ jours fermés et date du jour)
  useEffect(() => {
    let annule = false;
    fetch('/api/calendrier')
      .then((r) => lireReponse<Calendrier>(r))
      .then((r) => {
        if (annule) return;
        if (r.ok) setCal(r.donnees);
        setAcces(r.ok && r.donnees.gerant ? 'ouvert' : 'ferme');
      })
      .catch(() => {
        if (!annule) setAcces('ferme');
      });
    return () => {
      annule = true;
    };
  }, []);

  useEffect(() => {
    if (acces !== 'ouvert') return;
    let annule = false;
    (async () => {
      await Promise.resolve();
      if (!annule) await charger();
    })();
    return () => {
      annule = true;
    };
  }, [acces, charger]);

  const envoyer: Envoyer = async (url, methode, corps) => {
    try {
      const r = await lireReponse(
        await fetch(url, { method: methode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }),
      );
      if (!r.ok) {
        setRefus(r);
        // Accès gérant expiré : on redemande le code au lieu de laisser l'écran muet.
        if (r.code === 'ERR_DROIT_INSUFFISANT' || r.code === 'ERR_SESSION_EXPIREE') setAcces('ferme');
        return false;
      }
      setRefus(null);
      setMessage('Enregistré');
      setTimeout(() => setMessage(null), 2500);
      await charger();
      return true;
    } catch {
      const e = echecReseau();
      if (!e.ok) setRefus(e);
      return false;
    }
  };
  const enregistrerReglages = (partiel: Partial<Reglages>) => envoyer('/api/reglages', 'PUT', partiel);

  const refusAffiche = refus ? (
    <ListeSignalements
      className="mb-3"
      signalements={[refus]}
      autreSortiePour={() => (
        <Bouton onClick={() => setRefus(null)}>{acces === 'ferme' ? 'Ressaisir le code' : 'Fermer'}</Bouton>
      )}
    />
  ) : null;

  if (acces === 'inconnu') {
    return (
      <>
        <Chargement />
        <RappelChargement />
      </>
    );
  }

  if (acces === 'ferme') {
    return (
      <>
        <Entete titre="Réglages des commandes" sousTitre="Réservé au gérant." />
        {refusAffiche}
        <div className="max-w-xl">
          <AccesGerant
            raison="Saisissez le code gérant pour ouvrir les réglages."
            onAccorde={() => {
              setRefus(null);
              setAcces('ouvert');
            }}
            onAnnuler={() => history.back()}
          />
        </div>
      </>
    );
  }

  const onglets: { id: Onglet; libelle: string }[] = [
    { id: 'heures', libelle: 'Heures d’ouverture' },
    { id: 'tailles', libelle: 'Gâteaux' },
    { id: 'mots', libelle: 'Parfums et garnitures' },
    { id: 'signales', libelle: `Signalés${signales.length > 0 ? ` (${signales.length})` : ''}` },
  ];

  return (
    <>
      <Entete
        titre="Réglages des commandes"
        sousTitre="Les prix, minimums et formats viennent du tarif importé : ils ne se changent pas ici."
        actions={message ? <Puce ton="ok">{message}</Puce> : undefined}
      />
      <div role="tablist" aria-label="Sujet des réglages" className="mb-3 flex flex-wrap gap-1.5">
        {onglets.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={onglet === o.id}
            onClick={() => setOnglet(o.id)}
            className={`min-h-12 rounded-xl border-2 px-4 text-base ${
              onglet === o.id ? 'border-accent bg-accent-doux font-semibold text-accent' : 'border-line-fort bg-surface text-ink-2'
            }`}
          >
            {o.libelle}
          </button>
        ))}
      </div>
      {refusAffiche}

      {options === null || reglages === null || cal === null ? (
        <>
          <Chargement />
          <RappelChargement />
        </>
      ) : onglet === 'heures' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <HorairesParJour parJour={reglages.parJour} joursFermes={cal.joursFermes} enregistrer={enregistrerReglages} />
          <Exceptions reglages={reglages} cal={cal} enregistrer={enregistrerReglages} />
        </div>
      ) : onglet === 'tailles' ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <TaillesGateau tailles={reglages.taillesGateau} enregistrer={enregistrerReglages} />
          <DelaiEtages jours={reglages.delaiGateauEtagesJours} enregistrer={enregistrerReglages} />
        </div>
      ) : onglet === 'mots' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <ListeOptions titre="Parfums" detail="Proposés pour décrire un gâteau sur commande." genre="parfum" liste={options.parfums} envoyer={envoyer} />
          <ListeOptions titre="Garnitures" detail="Proposées pour le salé sur commande." genre="garniture" liste={options.garnitures} envoyer={envoyer} />
          <ListeOptions titre="Décorations" detail="Mots seulement : un supplément payant passe par le tarif." genre="decoration" liste={options.decorations} envoyer={envoyer} />
        </div>
      ) : (
        <section>
          <h2 className="text-base font-semibold text-ink">Produits signalés au comptoir</h2>
          <p className="mb-2 mt-0.5 text-sm text-ink-2">
            Demandes absentes du tarif, retenues par un vendeur. Faites-les ajouter au prochain import du tarif, puis
            rangez-les. Le prix indiqué est une proposition, jamais appliqué à une commande.
          </p>
          <Carte className="grid gap-1 p-3">
            {signales.length === 0 ? (
              <p className="text-base text-ink-2">Rien à ranger.</p>
            ) : (
              signales.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-line py-2 last:border-b-0">
                  <span className="min-w-0 flex-1 text-base text-ink">{p.nom}</span>
                  <span className="chiffres text-base text-ink-2">{formaterEuros(p.prixCentimes)}</span>
                  <Bouton onClick={() => void envoyer('/api/tarifs', 'PATCH', { id: p.id })}>Ranger</Bouton>
                </div>
              ))
            )}
          </Carte>
        </section>
      )}
    </>
  );
}

/** − 12:00 + : une heure au doigt, par pas de 30 minutes. */
function PasHeure({ heure, onChange, libelle }: { heure: string; onChange: (h: string) => void; libelle: string }) {
  const bouton = 'chiffres min-h-11 min-w-11 rounded-xl border-2 border-line-fort bg-surface text-2xl font-semibold text-ink active:bg-accent-doux';
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={bouton} aria-label={`${libelle} : 30 minutes plus tôt`} onClick={() => { const h = decaler(heure, -1); if (h) onChange(h); }}>
        −
      </button>
      <span className="chiffres w-14 text-center text-lg font-semibold text-ink">{heure}</span>
      <button type="button" className={bouton} aria-label={`${libelle} : 30 minutes plus tard`} onClick={() => { const h = decaler(heure, 1); if (h) onChange(h); }}>
        +
      </button>
    </div>
  );
}

/** Ouverture et fermeture d'un jour, au doigt. */
function PasPlage({ plage, onChange, libelle }: { plage: PlageOuverture; onChange: (p: PlageOuverture) => void; libelle: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <PasHeure heure={plage.ouverture} libelle={`${libelle}, ouverture`} onChange={(h) => onChange({ ...plage, ouverture: h })} />
      <span className="text-sm text-ink-2">à</span>
      <PasHeure heure={plage.fermeture} libelle={`${libelle}, fermeture`} onChange={(h) => onChange({ ...plage, fermeture: h })} />
    </div>
  );
}

function memePlage(a: PlageOuverture, b: PlageOuverture): boolean {
  return a.ouverture === b.ouverture && a.fermeture === b.fermeture;
}

function HorairesParJour({
  parJour,
  joursFermes,
  enregistrer,
}: {
  parJour: Record<JourIsoCle, PlageOuverture>;
  joursFermes: JourFerme[];
  enregistrer: (p: Partial<Reglages>) => Promise<boolean>;
}) {
  const [brouillon, setBrouillon] = useState(parJour);
  const [base, setBase] = useState(parJour);
  // Réglages relus du serveur : le brouillon repart de la valeur enregistrée.
  if (base !== parJour) {
    setBase(parJour);
    setBrouillon(parJour);
  }
  const modifies = JOURS_ISO_CLES.filter((j) => !memePlage(brouillon[j], parJour[j]));
  return (
    <section>
      <h2 className="text-base font-semibold text-ink">Heures d’ouverture du magasin</h2>
      <p className="mb-2 mt-0.5 text-sm text-ink-2">Ouverture et fermeture, jour par jour. Une heure de retrait en dehors est refusée.</p>
      <Carte className="grid gap-1 p-3">
        {JOURS_ISO_CLES.map((j) => {
          const ferme = fermetureDuJour(dateReference(j), joursFermes)?.nature === 'hebdomadaire';
          return (
            <div key={j} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-0.5 last:border-b-0">
              <span className={`min-w-0 text-base leading-tight ${ferme ? 'text-ink-3' : 'text-ink'}`}>
                {nomJour(j)}
                {ferme || !memePlage(brouillon[j], parJour[j]) ? (
                  <span className="block text-xs">
                    {ferme ? 'fermé' : null}
                    {ferme && !memePlage(brouillon[j], parJour[j]) ? ' · ' : null}
                    {!memePlage(brouillon[j], parJour[j]) ? <span className="text-accent">modifié</span> : null}
                  </span>
                ) : null}
              </span>
              <PasPlage plage={brouillon[j]} libelle={nomJour(j)} onChange={(p) => setBrouillon({ ...brouillon, [j]: p })} />
            </div>
          );
        })}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {modifies.length > 0 ? (
            <Bouton variante="discret" onClick={() => setBrouillon(parJour)}>
              Annuler
            </Bouton>
          ) : null}
          <Bouton
            variante="principal"
            disabled={modifies.length === 0}
            onClick={() => void enregistrer({ parJour: Object.fromEntries(modifies.map((j) => [j, brouillon[j]])) as Reglages['parJour'] })}
          >
            Enregistrer les heures
          </Bouton>
        </div>
      </Carte>
    </section>
  );
}

function Exceptions({
  reglages,
  cal,
  enregistrer,
}: {
  reglages: Reglages;
  cal: Calendrier;
  enregistrer: (p: Partial<Reglages>) => Promise<boolean>;
}) {
  const [date, setDate] = useState<string | null>(null);
  const [plage, setPlage] = useState<PlageOuverture | null>(null);
  // Heures habituelles du jour choisi (sans exception) : point de départ du réglage.
  const habituelle = (d: string): PlageOuverture | null => {
    try {
      return horairesOuvertureDuJour(d, { parJour: reglages.parJour, exceptions: [] });
    } catch {
      return null;
    }
  };
  const aVenir = reglages.exceptions.filter((e) => e.date >= cal.aujourdhui).sort((a, b) => (a.date < b.date ? -1 : 1));
  const plageAffichee = plage ?? (date ? habituelle(date) : null);

  return (
    <section>
      <h2 className="text-base font-semibold text-ink">Exceptions</h2>
      <p className="mb-2 mt-0.5 text-sm text-ink-2">Un jour précis, d’autres heures (ex. le 24 décembre, fermeture à 16:00).</p>
      <Carte className="grid gap-2 p-3">
        <SelecteurDateRetrait
          titre="Date de l’exception"
          valeur={date}
          aujourdhui={cal.aujourdhui}
          onChange={(d) => {
            setDate(d);
            const e = reglages.exceptions.find((x) => x.date === d);
            setPlage(e ? { ouverture: e.ouverture, fermeture: e.fermeture } : null);
          }}
          estJourFerme={(iso) => {
            const f = fermetureDuJour(iso, cal.joursFermes);
            return f ? { ferme: true, libelle: f.nature === 'hebdomadaire' ? undefined : f.libelle } : { ferme: false };
          }}
        />
        {date && plageAffichee ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-base text-ink">{libelleLong(date)}</span>
            <PasPlage plage={plageAffichee} libelle="Exception" onChange={setPlage} />
            <Bouton
              variante="principal"
              onClick={async () => {
                const autres = reglages.exceptions.filter((e) => e.date !== date);
                if (await enregistrer({ exceptions: [...autres, { date, ...plageAffichee }] })) {
                  setDate(null);
                  setPlage(null);
                }
              }}
            >
              Enregistrer l’exception
            </Bouton>
          </div>
        ) : null}
        <div className="border-t border-line pt-2">
          {aVenir.length === 0 ? (
            <p className="text-sm text-ink-2">Aucune exception à venir.</p>
          ) : (
            <ul className="grid gap-1">
              {aVenir.map((e) => (
                <li key={e.date} className="flex items-center justify-between gap-2">
                  <span className="text-base text-ink">
                    {libelleLong(e.date)} ·{' '}
                    <span className="chiffres font-semibold">
                      {e.ouverture} – {e.fermeture}
                    </span>
                  </span>
                  <Bouton
                    variante="danger"
                    onClick={() => void enregistrer({ exceptions: reglages.exceptions.filter((x) => x.date !== e.date) })}
                  >
                    Supprimer
                  </Bouton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Carte>
    </section>
  );
}

function TaillesGateau({ tailles, enregistrer }: { tailles: number[]; enregistrer: (p: Partial<Reglages>) => Promise<boolean> }) {
  const [ajout, setAjout] = useState(false);
  const [nouvelle, setNouvelle] = useState<number | null>(null);
  return (
    <section className="min-w-0">
      <h2 className="text-base font-semibold text-ink">Tailles standard des gâteaux (parts)</h2>
      <p className="mb-2 mt-0.5 text-sm text-ink-2">
        Proposées en boutons à la commande d’un gâteau simple. Une autre taille demande le code gérant.
      </p>
      <Carte className="grid gap-3 p-3 md:grid-cols-[1fr_auto]">
        <div>
          <div className="flex flex-wrap gap-1.5">
            {tailles.map((t) => (
              <button
                key={t}
                type="button"
                disabled={tailles.length <= 1}
                aria-label={`Retirer la taille ${t} parts`}
                onClick={() => void enregistrer({ taillesGateau: tailles.filter((x) => x !== t) })}
                className="chiffres inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-line-fort bg-surface px-4 text-lg font-semibold text-ink disabled:opacity-60"
              >
                {t}
                <span aria-hidden className="text-xl leading-none text-ink-3">×</span>
              </button>
            ))}
            {ajout ? null : (
              <button
                type="button"
                onClick={() => setAjout(true)}
                className="min-h-12 rounded-full border-2 border-dashed border-line-fort px-4 text-base text-ink-2"
              >
                + Ajouter une taille
              </button>
            )}
          </div>
          {tailles.length <= 1 ? (
            <p className="mt-2 text-sm text-ink-2">Gardez au moins une taille : ajoutez-en une avant de retirer celle-ci.</p>
          ) : null}
        </div>
        {ajout ? (
          <div className="grid w-72 gap-1">
            <PaveEntier
              libelle="Nouvelle taille"
              contexte="commande"
              libelleUnite="parts"
              chiffresMax={3}
              quantite={nouvelle}
              onChange={setNouvelle}
              libelleValider="Ajouter"
              onValider={async (n) => {
                if (tailles.includes(n) || (await enregistrer({ taillesGateau: [...tailles, n] }))) {
                  setAjout(false);
                  setNouvelle(null);
                }
              }}
            />
            <button type="button" onClick={() => setAjout(false)} className="min-h-12 text-sm text-ink-2 underline underline-offset-2">
              Fermer le pavé
            </button>
          </div>
        ) : null}
      </Carte>
    </section>
  );
}

/** Délai minimum d'un gâteau à étages (mariage, pièce montée), en jours ouvrés, au pavé de l'application. */
function DelaiEtages({ jours, enregistrer }: { jours: number; enregistrer: (p: Partial<Reglages>) => Promise<boolean> }) {
  const [ouvert, setOuvert] = useState(false);
  const [valeur, setValeur] = useState<number | null>(jours);
  return (
    <section className="min-w-0">
      <h2 className="text-base font-semibold text-ink">Délai des gâteaux à étages</h2>
      <p className="mb-2 mt-0.5 text-sm text-ink-2">
        Jours ouvrés minimum entre la commande et le retrait d’un gâteau à étages (mariage, pièce montée). Les jours
        fermés ne comptent pas. 0 : aucun délai particulier.
      </p>
      <Carte className="grid gap-2 p-3">
        <button
          type="button"
          aria-expanded={ouvert}
          onClick={() => {
            setValeur(jours);
            setOuvert(!ouvert);
          }}
          className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border-2 bg-surface px-4 text-left ${ouvert ? 'border-accent' : 'border-line-fort'}`}
        >
          <span className="text-sm text-ink-2">Délai</span>
          <span className="chiffres text-xl font-semibold text-ink">
            {jours} {jours > 1 ? 'jours ouvrés' : 'jour ouvré'}
          </span>
        </button>
        {ouvert ? (
          <div className="grid max-w-72 gap-1">
            <PaveEntier
              libelle="Délai des gâteaux à étages"
              contexte="inventaire"
              champ="delaiGateauEtagesJours"
              libelleUnite="jours"
              chiffresMax={2}
              quantite={valeur}
              onChange={setValeur}
              libelleValider="Enregistrer"
              onValider={async (n) => {
                if (n === jours || (await enregistrer({ delaiGateauEtagesJours: n }))) setOuvert(false);
              }}
            />
            <button type="button" onClick={() => setOuvert(false)} className="min-h-12 text-sm text-ink-2 underline underline-offset-2">
              Fermer le pavé
            </button>
          </div>
        ) : null}
      </Carte>
    </section>
  );
}

function ListeOptions({
  titre,
  detail,
  genre,
  liste,
  envoyer,
}: {
  titre: string;
  detail: string;
  genre: GenreOption;
  liste: OptionGateau[];
  envoyer: Envoyer;
}) {
  const [nom, setNom] = useState('');
  return (
    <section>
      <h2 className="text-base font-semibold text-ink">{titre}</h2>
      <p className="mb-2 mt-0.5 text-sm text-ink-2">{detail}</p>
      <Carte className="p-3">
        <div className="flex flex-wrap gap-1.5">
          {liste.map((o) => (
            <button
              key={o.id}
              type="button"
              title="Retirer ou remettre"
              onClick={() => void envoyer('/api/gateaux', 'PATCH', { id: o.id, actif: o.actif === false })}
              className={`min-h-11 rounded-full border px-3 text-sm ${
                o.actif === false ? 'border-line bg-surface text-ink-3 line-through' : 'border-line-fort bg-surface text-ink'
              }`}
            >
              {o.nom}
            </button>
          ))}
        </div>
        <form
          className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!nom.trim()) return;
            if (await envoyer('/api/gateaux', 'POST', { type: genre, nom: nom.trim() })) setNom('');
          }}
        >
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ajouter…" className={`${CHAMP} min-w-0 flex-1`} />
          <Bouton type="submit">Ajouter</Bouton>
        </form>
      </Carte>
    </section>
  );
}
