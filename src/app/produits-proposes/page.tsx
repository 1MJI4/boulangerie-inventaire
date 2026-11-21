'use client';

// src/app/produits-proposes/page.tsx
//
// Produits proposés par les vendeurs au comptage (propriétaire, 21/11/2026) — écran du profil Manager.
// Un vendeur a compté un produit absent de la liste d'inventaire. Le manager décide :
//   - l'AJOUTER à la liste (rayon + qui le produit) : le reste compté s'écrit sur le soir concerné ;
//   - c'est un produit DÉJÀ listé (une autre écriture) : on le rattache, le reste y est écrit s'il n'est pas compté ;
//   - une EXCEPTION : ponctuel, on ne l'ajoute pas.
// Ajouter un produit à la liste est réservé au gérant : le code est redemandé ICI, sur place, s'il a expiré.

import { useCallback, useEffect, useState } from 'react';
import { Alerte, Bouton, Carte, Chargement, Entete, EtatVide } from '@/components/ui';
import { Segmente } from '@/components/fiche/ElementsCommande';
import { AccesGerant } from '@/components/commande/AccesGerant';
import { echecReseau, lireReponse } from '@/components/commande/modele';
import { formatDateLong } from '@/lib/dateProduction';
import { useEquipe } from '@/lib/vendeurs';
import type { Echec } from '@/domaine/resultat';

type Proposition = {
  id: number;
  nom: string;
  quantite: number | null;
  journee: string;
  propositionPar: string;
  statut: 'a_valider' | 'ajoute' | 'exception';
  produitId: number | null;
  traitePar: string | null;
};
type Donnees = {
  propositions: Proposition[];
  produits: { id: number; nom: string; categorie: string }[];
  categories: string[];
  postes: string[];
};
type Onglet = 'a_valider' | 'traitees';
type Decision =
  | { action: 'exception' }
  | { action: 'existant'; produitId: number }
  | { action: 'ajouter'; categorie: string; poste: string; nom: string };

const LIBELLE_POSTE: Record<string, string> = { patissier: 'Pâtissier', boulanger: 'Boulanger', traiteur: 'Traiteur' };

export default function ProduitsProposes() {
  const { equipe, prete } = useEquipe();
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('a_valider');
  const [refus, setRefus] = useState<Echec | null>(null);
  const [par, setPar] = useState('');
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [categorie, setCategorie] = useState('');
  const [poste, setPoste] = useState('');
  const [nomFinal, setNomFinal] = useState('');
  const [existantId, setExistantId] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [enAttenteCode, setEnAttenteCode] = useState<{ id: number; decision: Decision } | null>(null);

  const charger = useCallback(async () => {
    try {
      const r = await lireReponse<Donnees>(await fetch('/api/produits-proposes', { cache: 'no-store' }));
      if (!r.ok) {
        setRefus(r);
        return;
      }
      setDonnees(r.donnees);
      setRefus(null);
    } catch {
      const e = echecReseau();
      if (!e.ok) setRefus(e);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(charger);
  }, [charger]);

  const decider = async (id: number, decision: Decision) => {
    if (!par.trim()) {
      setRefus({ ok: false, niveau: 'bloquant', code: 'ERR_CHAMP_OBLIGATOIRE', message: 'Touchez votre prénom (« Qui décide ? ») avant de décider.', champ: 'par' } as Echec);
      return;
    }
    setOccupe(true);
    setRefus(null);
    try {
      const reponse = await fetch('/api/produits-proposes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, par, ...decision }),
      });
      if (reponse.status === 403) {
        // Accès gérant expiré : le code est redemandé sur place, puis la décision repart.
        setEnAttenteCode({ id, decision });
        return;
      }
      const r = await lireReponse<unknown>(reponse);
      if (!r.ok) {
        setRefus(r);
        return;
      }
      setOuverte(null);
      setEnAttenteCode(null);
      await charger();
    } catch {
      const e = echecReseau();
      if (!e.ok) setRefus(e);
    } finally {
      setOccupe(false);
    }
  };

  const ouvrir = (p: Proposition) => {
    setOuverte(ouverte === p.id ? null : p.id);
    setNomFinal(p.nom);
    setCategorie('');
    setPoste('');
    setExistantId('');
  };

  const liste = (donnees?.propositions ?? []).filter((p) => (onglet === 'a_valider' ? p.statut === 'a_valider' : p.statut !== 'a_valider'));
  const nbAValider = (donnees?.propositions ?? []).filter((p) => p.statut === 'a_valider').length;
  const CHAMP = 'min-h-12 w-full rounded-2xl border-2 border-transparent bg-segment-fond px-3 text-base text-ink';

  return (
    <>
      <Entete
        titre="Produits proposés"
        sousTitre="Des produits comptés par les vendeurs, absents de la liste d’inventaire. Rien n’entre dans l’inventaire avant votre décision."
      />

      {refus ? <Alerte>{refus.message}</Alerte> : null}

      <div className="mb-3">
        <Segmente<Onglet>
          libelle="Propositions"
          valeur={onglet}
          onChange={setOnglet}
          options={[
            { valeur: 'a_valider', libelle: 'À décider', nombre: nbAValider },
            { valeur: 'traitees', libelle: 'Traitées' },
          ]}
        />
      </div>

      {onglet === 'a_valider' && nbAValider > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink">Qui décide ?</span>
          {prete
            ? equipe.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={par === n}
                  onClick={() => setPar(par === n ? '' : n)}
                  className={`min-h-11 rounded-xl border-2 px-3 text-sm font-medium ${
                    par === n ? 'border-transparent bg-accent-doux text-accent' : 'border-transparent bg-segment-fond text-ink'
                  }`}
                >
                  {n}
                </button>
              ))
            : null}
          <input
            value={equipe.includes(par) ? '' : par}
            onChange={(e) => setPar(e.target.value)}
            placeholder="Votre prénom"
            aria-label="Votre prénom"
            className="min-h-11 w-40 rounded-xl border-2 border-transparent bg-segment-fond px-3 text-sm text-ink placeholder:text-ink-3"
          />
        </div>
      ) : null}

      {donnees === null ? (
        <Chargement libelle="Chargement des propositions…" />
      ) : liste.length === 0 ? (
        <Carte>
          <EtatVide
            titre={onglet === 'a_valider' ? 'Aucun produit à décider' : 'Rien de traité ces deux dernières semaines'}
            detail={onglet === 'a_valider' ? 'Quand un vendeur compte un produit absent de la liste, il apparaît ici et vous recevez une notification.' : undefined}
          />
        </Carte>
      ) : (
        <ul className="grid gap-3">
          {liste.map((p) => (
            <li key={p.id}>
              <Carte className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-ink">{p.nom}</p>
                    <p className="text-sm text-ink-2">
                      {p.quantite === null ? 'Reste non donné' : `${p.quantite} en reste`} · compté le{' '}
                      <span>{formatDateLong(p.journee)}</span> · proposé par {p.propositionPar}
                    </p>
                  </div>
                  {p.statut !== 'a_valider' ? (
                    <p className={`shrink-0 text-sm font-semibold ${p.statut === 'ajoute' ? 'text-ok' : 'text-ink-2'}`}>
                      {p.statut === 'ajoute' ? 'Ajouté / rattaché' : 'Exception'}
                      {p.traitePar ? ` · ${p.traitePar}` : ''}
                    </p>
                  ) : null}
                </div>

                {p.statut === 'a_valider' ? (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Bouton variante="principal" onClick={() => ouvrir(p)}>
                        {ouverte === p.id ? 'Fermer' : 'Décider'}
                      </Bouton>
                      <Bouton variante="secondaire" disabled={occupe} onClick={() => void decider(p.id, { action: 'exception' })}>
                        Exception (ne pas ajouter)
                      </Bouton>
                    </div>

                    {ouverte === p.id && donnees ? (
                      <div className="mt-3 grid gap-4 rounded-2xl bg-surface-2 p-3">
                        <div className="grid gap-2">
                          <h3 className="text-base font-semibold text-ink">L’ajouter à la liste</h3>
                          <label className="block">
                            <span className="mb-1 block text-sm text-ink-2">Nom dans la liste</span>
                            <input value={nomFinal} onChange={(e) => setNomFinal(e.target.value)} maxLength={80} className={CHAMP} />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-sm text-ink-2">Rayon</span>
                            <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className={CHAMP}>
                              <option value="">Choisir…</option>
                              {donnees.categories.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-sm text-ink-2">Qui le produit ?</span>
                            <select value={poste} onChange={(e) => setPoste(e.target.value)} className={CHAMP}>
                              <option value="">Choisir…</option>
                              {donnees.postes.map((x) => (
                                <option key={x} value={x}>
                                  {LIBELLE_POSTE[x] ?? x}
                                </option>
                              ))}
                            </select>
                          </label>
                          <Bouton
                            variante="principal"
                            disabled={occupe || !categorie || !poste || nomFinal.trim().length < 2}
                            onClick={() => void decider(p.id, { action: 'ajouter', categorie, poste, nom: nomFinal })}
                          >
                            Ajouter à la liste
                          </Bouton>
                        </div>

                        <div className="grid gap-2 border-t border-line pt-3">
                          <h3 className="text-base font-semibold text-ink">C’est un produit déjà dans la liste</h3>
                          <select value={existantId} onChange={(e) => setExistantId(e.target.value)} className={CHAMP} aria-label="Produit de la liste">
                            <option value="">Choisir le produit…</option>
                            {donnees.produits.map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.nom} — {x.categorie}
                              </option>
                            ))}
                          </select>
                          <Bouton
                            variante="secondaire"
                            disabled={occupe || !existantId}
                            onClick={() => void decider(p.id, { action: 'existant', produitId: Number(existantId) })}
                          >
                            Rattacher à ce produit
                          </Bouton>
                        </div>
                      </div>
                    ) : null}

                    {enAttenteCode?.id === p.id ? (
                      <div className="mt-3">
                        <AccesGerant
                          raison="Décider d’un produit proposé est réservé au gérant : saisissez le code gérant."
                          onAccorde={() => void decider(enAttenteCode.id, enAttenteCode.decision)}
                          onAnnuler={() => setEnAttenteCode(null)}
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}
              </Carte>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
