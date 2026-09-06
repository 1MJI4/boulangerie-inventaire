'use client';

// src/app/commandes/reglages/page.tsx
//
// La grille est à jour aujourd'hui, elle ne le sera plus dans six mois. Le
// manager doit pouvoir corriger un prix, ajouter un parfum ou une décoration
// lui-même — sinon chaque changement de tarif repasse par une mise à jour de
// l'application, et la grille finit par mentir.

import { useCallback, useEffect, useState } from 'react';
import { Alerte, Bouton, Carte, Chargement, Entete, Puce } from '@/components/ui';
import { formaterEuros, lireMontant } from '@/lib/commandes';
import { COUPES_PAR_DEFAUT, type CompositionGateau, type FamilleGateau, type PalierGateau, type ReglageCoupes } from '@/lib/gateaux';

type Tarif = {
  id: number;
  nom: string;
  categorie: string;
  prixCentimes: number;
  actif: boolean;
  creeAuComptoir: boolean;
};

const CHAMP =
  'min-h-10 rounded-lg border border-line-fort bg-surface px-2.5 text-sm text-ink placeholder:text-ink-3';

export default function ReglagesCommandes() {
  const [code, setCode] = useState('');
  const [valide, setValide] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [composition, setComposition] = useState<CompositionGateau | null>(null);
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [recherche, setRecherche] = useState('');

  const charger = useCallback(async () => {
    const [c, t] = await Promise.all([
      fetch('/api/gateaux?inclureInactifs=1').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/tarifs?inclureInactifs=1').then((r) => (r.ok ? r.json() : [])),
    ]);
    setComposition(c);
    setTarifs(Array.isArray(t) ? t : []);
  }, []);

  useEffect(() => {
    if (valide) void charger();
  }, [valide, charger]);

  const verifier = async () => {
    setErreur(null);
    const reponse = await fetch('/api/gestion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (reponse.ok) setValide(true);
    else setErreur('Code incorrect.');
  };

  const annoncer = (texte: string) => {
    setMessage(texte);
    setTimeout(() => setMessage(null), 2500);
  };

  const envoyer = async (url: string, methode: 'POST' | 'PATCH', corps: Record<string, unknown>) => {
    const reponse = await fetch(url, {
      method: methode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...corps, codeSecurite: code }),
    });
    if (!reponse.ok) {
      const donnees = await reponse.json().catch(() => ({}));
      setErreur(donnees.error ?? 'Enregistrement impossible.');
      return false;
    }
    setErreur(null);
    annoncer('Enregistré');
    await charger();
    return true;
  };

  if (!valide) {
    return (
      <>
        <Entete titre="Réglages des commandes" sousTitre="Réservé au manager." />
        <Carte className="max-w-sm p-4">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-3" htmlFor="code">
            Code de gestion
          </label>
          <input
            id="code"
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void verifier()}
            inputMode="numeric"
            className={`${CHAMP} chiffres w-full`}
          />
          {erreur ? <p className="mt-2 text-sm text-alerte">{erreur}</p> : null}
          <Bouton variante="principal" className="mt-3 w-full" onClick={() => void verifier()}>
            Ouvrir
          </Bouton>
        </Carte>
      </>
    );
  }

  const tarifsVisibles = recherche.trim()
    ? tarifs.filter((t) => t.nom.toLowerCase().includes(recherche.trim().toLowerCase()))
    : tarifs.filter((t) => t.creeAuComptoir);

  return (
    <>
      <Entete
        titre="Réglages des commandes"
        sousTitre="Familles de gâteaux, parfums, décorations et grille tarifaire."
        actions={message ? <Puce ton="ok">{message}</Puce> : undefined}
      />

      {erreur ? <div className="mb-4"><Alerte>{erreur}</Alerte></div> : null}

      {composition === null ? (
        <Chargement />
      ) : (
        <div className="grid gap-6">
          {/* --------------------------------------------------- Coupes */}
          <Section
            titre="Tailles de gâteaux"
            detail="Un gâteau de 13 parts se coupe mal. Choisissez si le magasin le refuse ou se contente de proposer mieux."
          >
            <ReglageCoupesEditeur
              coupes={composition.coupes ?? COUPES_PAR_DEFAUT}
              onEnregistrer={(coupes) => envoyer('/api/gateaux', 'PATCH', { type: 'coupes', coupes })}
            />
          </Section>

          {/* ------------------------------------------------- Familles */}
          <Section
            titre="Familles de gâteaux"
            detail="Prix « à partir de », hors formats vendus au comptoir. Les minis sucrés sont ici : ce sont les parfums qui les qualifient."
          >
            {composition.familles
              .filter((f) => f.genre !== 'sale')
              .map((famille) => (
                <FamilleReglage
                  key={famille.id}
                  famille={famille}
                  onEnregistrer={(donnees) =>
                    envoyer('/api/gateaux', 'PATCH', { type: 'famille', id: famille.id, ...donnees })
                  }
                />
              ))}
            <AjoutOption
              placeholder="Nouvelle famille"
              avecPrix
              libellePrix="Prix par personne"
              onAjout={(nom, centimes) =>
                envoyer('/api/gateaux', 'POST', { type: 'famille', libelle: nom, parPersonneCentimes: centimes })
              }
            />
          </Section>

          {/* ------------------------------------------- Salé et minis */}
          <Section
            titre="Salé"
            detail="Même logique que les gâteaux : les bestella se comptent en personnes, les minis salés à la pièce."
          >
            {composition.familles
              .filter((f) => f.genre === 'sale')
              .map((famille) => (
                <FamilleReglage
                  key={famille.id}
                  famille={famille}
                  onEnregistrer={(donnees) =>
                    envoyer('/api/gateaux', 'PATCH', { type: 'famille', id: famille.id, ...donnees })
                  }
                />
              ))}
            <AjoutOption
              placeholder="Nouveau salé"
              avecPrix
              libellePrix="Prix à la pièce"
              onAjout={(nom, centimes) =>
                envoyer('/api/gateaux', 'POST', {
                  type: 'famille',
                  genre: 'sale',
                  unite: 'piece',
                  libelle: nom,
                  parPersonneCentimes: centimes,
                  minimumParts: 10,
                })
              }
            />
          </Section>

          {/* ------------------------------------------------ Garnitures */}
          <Section titre="Garnitures" detail="Proposées pour le salé, comme les parfums pour le sucré.">
            <div className="flex flex-wrap gap-1.5">
              {(composition.garnitures ?? []).map((garniture) => (
                <button
                  key={garniture.id}
                  type="button"
                  onClick={() =>
                    envoyer('/api/gateaux', 'PATCH', {
                      type: 'garniture',
                      id: garniture.id,
                      actif: garniture.actif === false,
                    })
                  }
                  className={`min-h-9 rounded-full border px-3 text-xs transition-colors ${
                    garniture.actif === false
                      ? 'border-line bg-surface text-ink-3 line-through'
                      : 'border-line-fort bg-surface text-ink'
                  }`}
                >
                  {garniture.nom}
                </button>
              ))}
            </div>
            <AjoutOption
              placeholder="Nouvelle garniture"
              onAjout={(nom) => envoyer('/api/gateaux', 'POST', { type: 'garniture', nom })}
            />
          </Section>

          {/* -------------------------------------------------- Parfums */}
          <Section titre="Parfums" detail="Proposés pour toutes les familles. Deux au maximum par gâteau.">
            <div className="flex flex-wrap gap-1.5">
              {composition.parfums.map((parfum) => (
                <button
                  key={parfum.id}
                  type="button"
                  onClick={() =>
                    envoyer('/api/gateaux', 'PATCH', {
                      type: 'parfum',
                      id: parfum.id,
                      actif: parfum.actif === false,
                    })
                  }
                  className={`min-h-9 rounded-full border px-3 text-xs transition-colors ${
                    parfum.actif === false
                      ? 'border-line bg-surface text-ink-3 line-through'
                      : 'border-line-fort bg-surface text-ink'
                  }`}
                  title="Activer ou retirer"
                >
                  {parfum.nom}
                </button>
              ))}
            </div>
            <AjoutOption
              placeholder="Nouveau parfum"
              onAjout={(nom) => envoyer('/api/gateaux', 'POST', { type: 'parfum', nom })}
            />
          </Section>

          {/* ---------------------------------------------- Décorations */}
          <Section titre="Décorations extérieures" detail="Un supplément à 0 € est compris dans le prix du gâteau.">
            {composition.decorations.map((deco) => (
              <LigneReglage
                key={deco.id}
                nom={deco.nom}
                valeur={deco.supplementCentimes}
                suffixe="supplément"
                actif={deco.actif !== false}
                onPrix={(centimes) =>
                  envoyer('/api/gateaux', 'PATCH', { type: 'decoration', id: deco.id, supplementCentimes: centimes })
                }
                onActif={(actif) => envoyer('/api/gateaux', 'PATCH', { type: 'decoration', id: deco.id, actif })}
              />
            ))}
            <AjoutOption
              placeholder="Nouvelle décoration"
              avecPrix
              libellePrix="Supplément"
              onAjout={(nom, centimes) =>
                envoyer('/api/gateaux', 'POST', { type: 'decoration', nom, supplementCentimes: centimes ?? 0 })
              }
            />
          </Section>

          {/* -------------------------------------------- Grille tarifaire */}
          <Section
            titre="Grille tarifaire"
            detail="Par défaut, seuls les libellés créés au comptoir sont affichés — ce sont ceux à ranger."
          >
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Chercher un produit dans les 234 lignes…"
              className={`${CHAMP} mb-2 w-full`}
            />
            {tarifsVisibles.length === 0 ? (
              <p className="text-sm text-ink-3">
                {recherche.trim() ? 'Aucun produit trouvé.' : 'Rien à ranger — la grille est propre.'}
              </p>
            ) : (
              tarifsVisibles.slice(0, 40).map((tarif) => (
                <LigneReglage
                  key={tarif.id}
                  nom={tarif.nom}
                  detail={tarif.creeAuComptoir ? 'Créé au comptoir — à ranger' : tarif.categorie}
                  valeur={tarif.prixCentimes}
                  actif={tarif.actif}
                  action={
                    tarif.creeAuComptoir
                      ? { libelle: 'Ranger', faire: () => envoyer('/api/tarifs', 'PATCH', { id: tarif.id, range: true }) }
                      : undefined
                  }
                  onPrix={(centimes) => envoyer('/api/tarifs', 'PATCH', { id: tarif.id, prixCentimes: centimes })}
                  onActif={(actif) => envoyer('/api/tarifs', 'PATCH', { id: tarif.id, actif })}
                />
              ))
            )}
          </Section>
        </div>
      )}
    </>
  );
}

/**
 * Trois réglages, dans l'ordre où on les décide : ce qu'on fait d'une taille
 * qui se coupe mal, les tailles qu'on propose à la place, et les impairs qu'on
 * accepte quand même — la part seule, et le 5.
 */
function ReglageCoupesEditeur({
  coupes,
  onEnregistrer,
}: {
  coupes: ReglageCoupes;
  onEnregistrer: (coupes: ReglageCoupes) => void;
}) {
  const [mode, setMode] = useState(coupes.mode);
  const [conseillees, setConseillees] = useState(coupes.conseillees.join(' '));
  const [exceptions, setExceptions] = useState(coupes.exceptions.join(' '));
  const [tolererPairs, setTolererPairs] = useState(coupes.tolererPairs);

  const lireNombres = (texte: string) =>
    [...new Set(texte.split(/[^0-9]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0))].sort(
      (a, b) => a - b
    );

  const MODES: { cle: ReglageCoupes['mode']; libelle: string; detail: string }[] = [
    { cle: 'libre', libelle: 'Rien', detail: 'toutes les tailles passent' },
    { cle: 'avertir', libelle: 'Proposer mieux', detail: 'le vendeur reste libre' },
    { cle: 'interdire', libelle: 'Refuser', detail: 'la taille est bloquée' },
  ];

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.cle}
            type="button"
            onClick={() => setMode(m.cle)}
            className={`min-h-10 rounded-lg border px-3 text-left text-xs transition-colors ${
              mode === m.cle
                ? 'border-accent bg-accent-doux text-accent'
                : 'border-line-fort bg-surface text-ink-2 hover:text-ink'
            }`}
          >
            <span className="block font-medium">{m.libelle}</span>
            <span className="block opacity-70">{m.detail}</span>
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-xs text-ink-2" htmlFor="conseillees">
          Tailles proposées au vendeur
        </label>
        <input
          id="conseillees"
          value={conseillees}
          onChange={(e) => setConseillees(e.target.value)}
          placeholder="4 6 8 10 12 15 20 25 30 40 50"
          className={`${CHAMP} chiffres w-full`}
        />
        <p className="mt-1 text-xs text-ink-3">
          Séparées par des espaces. Elles s’affichent en boutons dans l’assistant.
        </p>
      </div>

      <label className="flex items-start gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          checked={tolererPairs}
          onChange={(e) => setTolererPairs(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
        />
        <span>
          Accepter tous les nombres pairs
          <span className="block text-xs text-ink-3">
            Un nombre pair se coupe toujours en deux. Les multiples de cinq passent de toute façon.
          </span>
        </span>
      </label>

      <div>
        <label className="mb-1 block text-xs text-ink-2" htmlFor="exceptions">
          Impairs acceptés malgré tout
        </label>
        <input
          id="exceptions"
          value={exceptions}
          onChange={(e) => setExceptions(e.target.value)}
          placeholder="1 5"
          className={`${CHAMP} chiffres w-40`}
        />
      </div>

      <Bouton
        variante="principal"
        className="min-h-10 justify-self-start px-4 text-xs"
        onClick={() =>
          onEnregistrer({
            mode,
            conseillees: lireNombres(conseillees),
            tolererPairs,
            exceptions: lireNombres(exceptions),
          })
        }
      >
        Enregistrer
      </Bouton>
    </div>
  );
}

/**
 * Une famille de gâteaux se règle sur trois choses : le minimum de parts, les
 * paliers de prix par personne, et son maintien au catalogue. Les paliers sont
 * le cœur : « à partir de 20 personnes, 5 € la part » est une règle que le
 * magasin applique déjà, et qu'aucun tarif unique ne peut représenter.
 */
function FamilleReglage({
  famille,
  onEnregistrer,
}: {
  famille: FamilleGateau;
  onEnregistrer: (donnees: Record<string, unknown>) => void;
}) {
  const paliersInitiaux: PalierGateau[] =
    famille.paliers && famille.paliers.length > 0
      ? famille.paliers
      : [{ aPartirDe: 1, centimes: famille.parPersonneCentimes }];

  const [minimum, setMinimum] = useState(famille.minimumParts ? String(famille.minimumParts) : '');
  const [paliers, setPaliers] = useState(
    paliersInitiaux.map((p) => ({
      aPartirDe: String(p.aPartirDe),
      prix: (p.centimes / 100).toFixed(2).replace('.', ','),
    }))
  );

  const actif = famille.actif !== false;

  const enregistrer = () => {
    const propres = paliers
      .map((p) => ({ aPartirDe: Number(p.aPartirDe) || 1, centimes: lireMontant(p.prix) ?? 0 }))
      .filter((p) => p.centimes > 0)
      .sort((a, b) => a.aPartirDe - b.aPartirDe);
    if (propres.length === 0) return;
    onEnregistrer({
      minimumParts: minimum.trim() === '' ? 0 : Number(minimum) || 0,
      paliers: propres,
      parPersonneCentimes: propres[0].centimes,
    });
  };

  return (
    <div className="border-b border-line py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-sm font-medium ${actif ? 'text-ink' : 'text-ink-3 line-through'}`}>
          {famille.libelle}
        </span>
        <button
          type="button"
          onClick={() => onEnregistrer({ actif: !actif })}
          className="text-xs text-ink-3 underline underline-offset-2 hover:text-ink"
        >
          {actif ? 'Retirer' : 'Remettre'}
        </button>
      </div>

      {famille.unite === 'piece' ? (
        <p className="mt-0.5 text-xs text-ink-3">Compté à la pièce.</p>
      ) : null}

      {famille.formatsFixes ? (
        <p className="mt-0.5 text-xs text-ink-3">
          Formats du comptoir :{' '}
          {Object.entries(famille.formatsFixes)
            .map(([parts, centimes]) => `${parts}P ${formaterEuros(centimes)}`)
            .join(' · ')}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="text-xs text-ink-2" htmlFor={`min-${famille.id}`}>
          Minimum
        </label>
        <input
          id={`min-${famille.id}`}
          value={minimum}
          onChange={(e) => setMinimum(e.target.value)}
          inputMode="numeric"
          placeholder="aucun"
          className={`${CHAMP} chiffres w-20 text-center`}
        />
        <span className="text-xs text-ink-3">{famille.unite === 'piece' ? 'pièces' : 'parts'}</span>
      </div>

      <div className="mt-2 grid gap-1.5">
        {paliers.map((palier, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-2">à partir de</span>
            <input
              value={palier.aPartirDe}
              onChange={(e) =>
                setPaliers((liste) =>
                  liste.map((p, i) => (i === index ? { ...p, aPartirDe: e.target.value } : p))
                )
              }
              inputMode="numeric"
              aria-label="À partir de combien de personnes"
              className={`${CHAMP} chiffres w-16 text-center`}
            />
            <span className="text-xs text-ink-2">{famille.unite === 'piece' ? 'pièces' : 'pers.'}</span>
            <input
              value={palier.prix}
              onChange={(e) =>
                setPaliers((liste) =>
                  liste.map((p, i) => (i === index ? { ...p, prix: e.target.value } : p))
                )
              }
              inputMode="decimal"
              aria-label="Prix par personne"
              className={`${CHAMP} chiffres w-20 text-right`}
            />
            <span className="text-xs text-ink-3">{famille.unite === 'piece' ? '€/pièce' : '€/pers'}</span>
            {paliers.length > 1 ? (
              <button
                type="button"
                onClick={() => setPaliers((liste) => liste.filter((_, i) => i !== index))}
                className="px-1 text-sm text-ink-3 hover:text-alerte"
                aria-label="Retirer ce palier"
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setPaliers((liste) => [
              ...liste,
              { aPartirDe: String((Number(liste[liste.length - 1]?.aPartirDe) || 1) + 10), prix: '' },
            ])
          }
          className="text-xs text-ink-2 underline underline-offset-2 hover:text-ink"
        >
          Ajouter un palier
        </button>
        <Bouton variante="principal" className="min-h-10 px-3 text-xs" onClick={enregistrer}>
          Enregistrer
        </Bouton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Morceaux */

function Section({
  titre,
  detail,
  children,
}: {
  titre: string;
  detail?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-sm font-medium text-ink">{titre}</h2>
      {detail ? <p className="mb-2 mt-0.5 text-xs text-ink-3">{detail}</p> : null}
      <Carte className="grid gap-1 p-3">{children}</Carte>
    </section>
  );
}

function LigneReglage({
  nom,
  detail,
  valeur,
  suffixe,
  actif,
  action,
  onPrix,
  onActif,
}: {
  nom: string;
  detail?: string;
  valeur: number;
  suffixe?: string;
  actif: boolean;
  action?: { libelle: string; faire: () => void };
  onPrix: (centimes: number) => void;
  onActif: (actif: boolean) => void;
}) {
  const [saisie, setSaisie] = useState(() => (valeur / 100).toFixed(2).replace('.', ','));
  const centimes = lireMontant(saisie);
  const change = centimes !== null && centimes !== valeur;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <span className={`block text-sm ${actif ? 'text-ink' : 'text-ink-3 line-through'}`}>{nom}</span>
        {detail ? <span className="block text-xs text-ink-3">{detail}</span> : null}
      </div>
      <input
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        inputMode="decimal"
        aria-label={`Prix de ${nom}`}
        className={`${CHAMP} chiffres w-20 text-right`}
      />
      {suffixe ? <span className="text-xs text-ink-3">{suffixe}</span> : null}
      {change ? (
        <Bouton variante="principal" className="min-h-10 px-3 text-xs" onClick={() => onPrix(centimes)}>
          Enregistrer
        </Bouton>
      ) : null}
      {action ? (
        <Bouton className="min-h-10 px-3 text-xs" onClick={action.faire}>
          {action.libelle}
        </Bouton>
      ) : null}
      <button
        type="button"
        onClick={() => onActif(!actif)}
        className="px-1 text-xs text-ink-3 underline underline-offset-2 hover:text-ink"
      >
        {actif ? 'Retirer' : 'Remettre'}
      </button>
    </div>
  );
}

function AjoutOption({
  placeholder,
  avecPrix = false,
  libellePrix,
  onAjout,
}: {
  placeholder: string;
  avecPrix?: boolean;
  libellePrix?: string;
  onAjout: (nom: string, centimes?: number) => void;
}) {
  const [nom, setNom] = useState('');
  const [prix, setPrix] = useState('');

  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!nom.trim()) return;
        onAjout(nom.trim(), avecPrix ? (lireMontant(prix) ?? 0) : undefined);
        setNom('');
        setPrix('');
      }}
    >
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        placeholder={placeholder}
        className={`${CHAMP} min-w-0 flex-1`}
      />
      {avecPrix ? (
        <input
          value={prix}
          onChange={(e) => setPrix(e.target.value)}
          inputMode="decimal"
          placeholder={libellePrix}
          aria-label={libellePrix}
          className={`${CHAMP} chiffres w-28 text-right`}
        />
      ) : null}
      <Bouton type="submit" className="min-h-10 px-3 text-xs">
        Ajouter
      </Bouton>
    </form>
  );
}
