'use client';

// Ce qui sort du four. Le mode addition permet d'enregistrer une deuxième
// fournée sans effacer la première.
//
// LOI 2 : un produit au kilo se saisit au pavé décimal (grammes). Les
// contrôles de vraisemblance viennent du domaine (verifierProduction) et
// s'affichent avec <Signalement>, sans bloquer.

import { useMemo, useState } from 'react';
import { Alerte, Bouton, Carte, Chargement, Entete, EtatVide, Progression, Puce } from '@/components/ui';
import { IndicateurSauvegarde } from '@/components/IndicateurSauvegarde';
import { LigneSaisie } from '@/components/LigneSaisie';
import { SelecteurJournee } from '@/components/SelecteurJournee';
import { formatDateLong, journeeProduction } from '@/lib/dateProduction';
import { useProfil } from '@/components/ProfilAppareil';
import { controlesProduction, type SignalementLigne } from '@/lib/inventaire/controles';
import { PaveSaisieProduit } from '@/components/inventaire/PaveSaisieProduit';
import { SignalementsLigne } from '@/components/inventaire/SignalementsLigne';
import { RappelChargement } from '@/components/rappels';
import { formaterQuantite } from '@/domaine/unites';
import { LIBELLE_POSTE, POSTES, type Poste } from '@/lib/postes';
import { DEFINITIONS } from '@/lib/profils';
import { useSaisieJournee } from '@/lib/useSaisieJournee';

export default function SaisieProduction() {
  const [date, setDate] = useState(() => journeeProduction());
  const { profil } = useProfil();
  const posteImpose = profil ? DEFINITIONS[profil].posteImpose : undefined;
  const [posteChoisi, setPoste] = useState<Poste>('patissier');
  // Le boulanger ne saisit que sa propre production.
  const poste: Poste = posteImpose ?? posteChoisi;
  const [recherche, setRecherche] = useState('');
  /** Produit au kilo en cours de pesée (pavé décimal ouvert). */
  const [pesee, setPesee] = useState<number | null>(null);

  const saisie = useSaisieJournee({ date, champ: 'quantiteProduite', poste });

  const produitsVisibles = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return saisie.produits;
    return saisie.produits.filter((p) => p.nom.toLowerCase().includes(terme));
  }, [saisie.produits, recherche]);

  const produitPese = pesee === null ? null : (saisie.produits.find((p) => p.id === pesee) ?? null);

  const signalementsDe = (produit: (typeof saisie.produits)[number]): SignalementLigne[] => {
    const refus = saisie.refus.get(produit.id);
    return [
      ...(refus ? [refus] : []),
      ...controlesProduction(
        produit,
        saisie.valeurs[produit.id],
        saisie.inventaires.get(produit.id)?.quantitePrevue
      ),
      ...(saisie.avertissementsServeur.get(produit.id) ?? []),
    ];
  };

  const parCategorie = useMemo(() => {
    const groupes = new Map<string, typeof produitsVisibles>();
    for (const produit of produitsVisibles) {
      const liste = groupes.get(produit.categorie) ?? [];
      liste.push(produit);
      groupes.set(produit.categorie, liste);
    }
    return [...groupes.entries()];
  }, [produitsVisibles]);

  return (
    <div className={produitPese ? 'pb-[30rem]' : ''}>
      <Entete
        titre="Production réalisée"
        sousTitre={
          <>
            Quantités sorties du four le{' '}
            <span className="font-medium capitalize text-ink">{formatDateLong(date)}</span>
          </>
        }
        actions={<SelecteurJournee date={date} onChange={setDate} libelle="Fournée" />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {posteImpose ? null : (
          <div role="tablist" aria-label="Poste" className="flex gap-1 rounded-lg border border-line bg-surface p-1">
            {POSTES.map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={poste === p}
                onClick={() => setPoste(p)}
                className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors ${
                  poste === p ? 'bg-accent-doux text-accent' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                }`}
              >
                {LIBELLE_POSTE[p]}
              </button>
            ))}
          </div>
        )}

        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher un produit…"
          aria-label="Chercher un produit"
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none sm:max-w-64"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Progression fait={saisie.nbRenseignes} total={saisie.produits.length} />
        <IndicateurSauvegarde
          statut={saisie.statut}
          derniereSauvegarde={saisie.derniereSauvegarde}
          nbEnAttente={saisie.nbEnAttente}
          messageErreur={saisie.messageErreur}
          onReessayer={() => void saisie.enregistrerMaintenant()}
        />
      </div>

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
          <Chargement />
          <RappelChargement className="mx-auto max-w-md" />
        </>
      ) : produitsVisibles.length === 0 ? (
        <Carte>
          <EtatVide titre="Aucun produit à afficher" />
        </Carte>
      ) : (
        <div className="space-y-4">
          {parCategorie.map(([categorie, produits]) => (
            <Carte key={categorie}>
              <h2 className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
                {categorie}
              </h2>
              {produits.map((produit) => {
                const prevue = saisie.inventaires.get(produit.id)?.quantitePrevue;
                const signalements = signalementsDe(produit);
                return (
                  <LigneSaisie
                    key={produit.id}
                    nom={produit.nom}
                    unite={produit.unite}
                    selectionne={pesee === produit.id}
                    onSelectionner={produit.unite === 'kg' ? () => setPesee(produit.id) : undefined}
                    valeur={saisie.valeurs[produit.id] ?? ''}
                    onChange={(v) => saisie.definir(produit.id, v)}
                    suggestion={produit.unite === 'kg' ? null : (prevue ?? null)}
                    onAppliquerSuggestion={
                      prevue != null ? () => saisie.definir(produit.id, String(prevue)) : undefined
                    }
                    indice={
                      prevue != null ? (
                        <>
                          demandé&nbsp;:{' '}
                          <span className="chiffres">
                            {produit.unite === 'kg' ? formaterQuantite('kg', prevue) : prevue}
                          </span>
                        </>
                      ) : null
                    }
                    signalements={
                      signalements.length > 0 ? (
                        <SignalementsLigne
                          signalements={signalements}
                          onEffacer={() => saisie.definir(produit.id, '')}
                        />
                      ) : undefined
                    }
                  />
                );
              })}
            </Carte>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <Puce ton={saisie.nbRenseignes > 0 ? 'accent' : 'neutre'}>
          <span className="chiffres">{saisie.nbRenseignes}</span> produits renseignés
        </Puce>
        <Bouton
          variante="principal"
          onClick={() => void saisie.enregistrerMaintenant()}
          disabled={saisie.nbEnAttente === 0 || saisie.statut === 'envoi'}
        >
          {saisie.statut === 'envoi' ? 'Enregistrement…' : 'Enregistrer maintenant'}
        </Bouton>
      </div>

      {produitPese ? (
        <PaveSaisieProduit
          produit={produitPese}
          valeur={saisie.valeurs[produitPese.id] ?? ''}
          onChange={(v) => saisie.definir(produitPese.id, v)}
          onFermer={() => setPesee(null)}
        />
      ) : null}
    </div>
  );
}
