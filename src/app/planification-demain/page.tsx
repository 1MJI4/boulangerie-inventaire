'use client';

// Écran du fournil : ce que le manager a demandé pour la journée en cours.
//
// Deux exigences propres à ce poste. La journée affichée est la journée de
// production (bascule à 14h) et non « demain » : ouverte à 3h du matin, la
// page cherchait auparavant les prévisions du surlendemain et restait vide.
// Et l'écran reste allumé des heures sur un plan de travail : il va donc
// chercher les nouvelles quantités tout seul, et signale ce qui vient
// d'arriver plutôt que de les glisser silencieusement dans la liste.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alerte, Bouton, Carte, Chargement, Entete, EtatVide, Progression, Puce } from '@/components/ui';
import { SelecteurJournee } from '@/components/SelecteurJournee';
import { formatDateLong, journeeProduction } from '@/lib/dateProduction';
import { useProfil } from '@/components/ProfilAppareil';
import { useMemoireLocale } from '@/lib/memoireLocale';
import { DEFINITIONS } from '@/lib/profils';
import { DESCRIPTION_POSTE, LIBELLE_POSTE, POSTES, estPoste, type Poste } from '@/lib/postes';

type LigneFournil = {
  produitId: number;
  quantitePrevue: number | null;
  quantiteProduite: number | null;
  faitLe: string | null;
  produit: { id: number; nom: string; categorie: string; poste: Poste; ordre: number };
};

/** Le manager saisit pendant que le fournil regarde : on va rechercher souvent. */
const INTERVALLE_RAFRAICHISSEMENT_MS = 45_000;

export default function Fournil() {
  const [date, setDate] = useState(() => journeeProduction());
  const { profil } = useProfil();
  const [posteMemorise, setPosteMemorise] = useMemoireLocale<string>(
    'boulangerie:poste-fournil',
    'patissier'
  );

  // Sur la tablette du pâtissier, le poste n'est pas un choix : il ne doit
  // jamais tomber sur la liste du boulanger. Seul le manager garde les onglets.
  const posteImpose = profil ? DEFINITIONS[profil].posteImpose : undefined;
  const poste: Poste =
    posteImpose ?? (estPoste(posteMemorise) ? posteMemorise : 'patissier');

  const [lignes, setLignes] = useState<LigneFournil[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<Set<number>>(new Set());
  const [actualiseA, setActualiseA] = useState<Date | null>(null);
  const [nouveautes, setNouveautes] = useState<Set<number>>(new Set());

  // Ce que le fournil avait déjà sous les yeux, pour ne signaler que le neuf.
  const dejaVus = useRef<Map<number, number | null> | null>(null);

  const charger = useCallback(
    async (silencieux = false) => {
      if (!silencieux) setChargement(true);
      try {
        const reponse = await fetch(`/api/inventaires?date=${date}&poste=${poste}&avecPrevision=1`);
        if (!reponse.ok) throw new Error('chargement impossible');
        const donnees: LigneFournil[] = await reponse.json();

        const precedent = dejaVus.current;
        if (precedent) {
          const neuf = new Set<number>();
          for (const ligne of donnees) {
            const avant = precedent.get(ligne.produitId);
            if (avant === undefined || avant !== ligne.quantitePrevue) neuf.add(ligne.produitId);
          }
          if (neuf.size > 0) setNouveautes((prec) => new Set([...prec, ...neuf]));
        }

        dejaVus.current = new Map(donnees.map((l) => [l.produitId, l.quantitePrevue]));
        setLignes(donnees);
        setActualiseA(new Date());
        setErreur(null);
      } catch {
        if (!silencieux) setErreur('Impossible de charger la feuille de production.');
      } finally {
        setChargement(false);
      }
    },
    [date, poste]
  );

  // Changer de poste ou de journée remet le compteur de nouveautés à zéro.
  useEffect(() => {
    dejaVus.current = null;
    setNouveautes(new Set());
    void charger();
  }, [charger]);

  // Relecture régulière, mise en pause quand l'écran n'est pas regardé.
  useEffect(() => {
    const tic = setInterval(() => {
      if (document.visibilityState === 'visible') void charger(true);
    }, INTERVALLE_RAFRAICHISSEMENT_MS);

    const auReveil = () => {
      if (document.visibilityState === 'visible') void charger(true);
    };
    document.addEventListener('visibilitychange', auReveil);

    return () => {
      clearInterval(tic);
      document.removeEventListener('visibilitychange', auReveil);
    };
  }, [charger]);

  const basculerFait = async (ligne: LigneFournil) => {
    const faitMaintenant = ligne.faitLe === null;
    const horodatage = faitMaintenant ? new Date().toISOString() : null;

    setLignes((prec) =>
      prec.map((l) => (l.produitId === ligne.produitId ? { ...l, faitLe: horodatage } : l))
    );
    setEnCours((prec) => new Set(prec).add(ligne.produitId));

    try {
      const reponse = await fetch('/api/inventaires', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateInventaire: date,
          inventaires: [{ produitId: ligne.produitId, faitLe: horodatage }],
        }),
      });
      if (!reponse.ok) throw new Error();
    } catch {
      setLignes((prec) =>
        prec.map((l) => (l.produitId === ligne.produitId ? { ...l, faitLe: ligne.faitLe } : l))
      );
      setErreur("La coche n'a pas pu être enregistrée. Vérifiez la connexion.");
    } finally {
      setEnCours((prec) => {
        const suivant = new Set(prec);
        suivant.delete(ligne.produitId);
        return suivant;
      });
    }
  };

  const parCategorie = useMemo(() => {
    const groupes = new Map<string, LigneFournil[]>();
    for (const ligne of [...lignes].sort((a, b) => a.produit.ordre - b.produit.ordre)) {
      const liste = groupes.get(ligne.produit.categorie) ?? [];
      liste.push(ligne);
      groupes.set(ligne.produit.categorie, liste);
    }
    return [...groupes.entries()];
  }, [lignes]);

  const faits = lignes.filter((l) => l.faitLe !== null).length;
  const total = lignes.reduce((somme, l) => somme + (l.quantitePrevue ?? 0), 0);

  return (
    <>
      <Entete
        titre={`Feuille ${LIBELLE_POSTE[poste].toLowerCase()}`}
        sousTitre={
          <>
            À produire pour le{' '}
            <span className="font-medium capitalize text-ink">{formatDateLong(date)}</span>
          </>
        }
        actions={
          <div className="sans-impression flex items-center gap-2">
            <SelecteurJournee date={date} onChange={setDate} libelle="Fournée" />
            <Bouton variante="secondaire" onClick={() => window.print()}>
              Imprimer
            </Bouton>
          </div>
        }
      />

      <div className="sans-impression mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {posteImpose ? (
            <span className="text-xs text-ink-3">{DESCRIPTION_POSTE[poste]}</span>
          ) : (
            <>
              <div role="tablist" aria-label="Poste" className="flex gap-1 rounded-lg border border-line bg-surface p-1">
                {POSTES.map((p) => (
                  <button
                    key={p}
                    role="tab"
                    aria-selected={poste === p}
                    onClick={() => setPosteMemorise(p)}
                    className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors ${
                      poste === p ? 'bg-accent-doux text-accent' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                    }`}
                  >
                    {LIBELLE_POSTE[p]}
                  </button>
                ))}
              </div>
              <span className="text-xs text-ink-3">{DESCRIPTION_POSTE[poste]}</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => void charger(true)}
          className="text-xs text-ink-3 underline underline-offset-2 hover:text-ink-2"
          title="Relancer la lecture maintenant"
        >
          {actualiseA
            ? `actualisé à ${actualiseA.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}`
            : 'actualiser'}
        </button>
      </div>

      {nouveautes.size > 0 ? (
        <div className="sans-impression mb-4">
          <Alerte ton="ok">
            <span className="font-medium">
              {nouveautes.size} quantité{nouveautes.size > 1 ? 's' : ''} vient
              {nouveautes.size > 1 ? 'nent' : ''} d&apos;arriver du manager.
            </span>{' '}
            <button
              onClick={() => setNouveautes(new Set())}
              className="underline underline-offset-2"
            >
              J&apos;ai vu
            </button>
          </Alerte>
        </div>
      ) : null}

      {erreur ? (
        <div className="sans-impression mb-4">
          <Alerte>
            {erreur}{' '}
            <button onClick={() => void charger()} className="underline underline-offset-2">
              Réessayer
            </button>
          </Alerte>
        </div>
      ) : null}

      {chargement ? (
        <Chargement libelle="Chargement de la feuille…" />
      ) : lignes.length === 0 ? (
        <Carte>
          <EtatVide
            titre="Le manager n'a pas encore envoyé de quantités"
            detail={`Rien n'est demandé au ${LIBELLE_POSTE[poste].toLowerCase()} pour le ${formatDateLong(date)}. Cet écran se met à jour tout seul : laissez-le ouvert, les quantités apparaîtront dès la saisie.`}
          />
        </Carte>
      ) : (
        <div className="zone-impression space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Puce ton="accent">
                <span className="chiffres">{total}</span> pièces au total
              </Puce>
              <Puce ton={faits === lignes.length ? 'ok' : 'neutre'}>
                <span className="chiffres">{lignes.length}</span> références
              </Puce>
            </div>
            <div className="sans-impression">
              <Progression fait={faits} total={lignes.length} />
            </div>
          </div>

          {parCategorie.map(([categorie, liste]) => (
            <Carte key={categorie}>
              <h2 className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
                {categorie}
              </h2>

              <ul>
                {liste.map((ligne) => {
                  const fait = ligne.faitLe !== null;
                  const nouveau = nouveautes.has(ligne.produitId);

                  return (
                    <li
                      key={ligne.produitId}
                      className={`ligne-impression flex items-center gap-4 border-b border-line px-4 py-3 last:border-b-0 ${
                        nouveau ? 'bg-ok-doux' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void basculerFait(ligne)}
                        disabled={enCours.has(ligne.produitId)}
                        aria-pressed={fait}
                        aria-label={`Marquer ${ligne.produit.nom} comme produit`}
                        className={`sans-impression flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-sm transition-colors ${
                          fait
                            ? 'border-ok bg-ok text-white'
                            : 'border-line-fort text-transparent hover:border-accent'
                        }`}
                      >
                        ✓
                      </button>

                      <span
                        aria-hidden
                        className="ligne-impression hidden h-5 w-5 shrink-0 border border-black print:block"
                      />

                      <span
                        className={`min-w-0 flex-1 truncate text-lg ${
                          fait ? 'text-ink-3 line-through' : 'text-ink'
                        }`}
                      >
                        {ligne.produit.nom}
                        {nouveau ? (
                          <span className="sans-impression ml-2 text-xs font-medium text-ok">
                            nouveau
                          </span>
                        ) : null}
                      </span>

                      {ligne.quantiteProduite != null ? (
                        <span className="sans-impression chiffres shrink-0 text-xs text-ink-3">
                          {ligne.quantiteProduite} produits
                        </span>
                      ) : null}

                      <span
                        className={`chiffres shrink-0 text-3xl font-semibold tabular-nums ${
                          fait ? 'text-ink-3' : 'text-ink'
                        }`}
                      >
                        {ligne.quantitePrevue}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Carte>
          ))}
        </div>
      )}
    </>
  );
}
