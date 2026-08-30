'use client';

// Écran du manager, quelques heures avant la fournée : il note ce qu'il veut
// voir produit. Dès qu'il saisit, le pâtissier le voit sur son écran.
//
// En pratique il ne planifie presque que la viennoiserie. C'est donc le seul
// rayon ouvert à l'arrivée ; les autres sont là, repliés, pour les fois où il
// en a besoin — et s'ouvrent d'eux-mêmes s'ils contiennent déjà des quantités.

import { useEffect, useMemo, useState } from 'react';
import { Alerte, Bouton, Carte, Chargement, Entete, EtatVide, Progression, Puce } from '@/components/ui';
import { IndicateurSauvegarde } from '@/components/IndicateurSauvegarde';
import { LigneSaisie } from '@/components/LigneSaisie';
import { SelecteurJournee } from '@/components/SelecteurJournee';
import { formatDateLong, journeeProduction } from '@/lib/dateProduction';
import { useMemoireLocale } from '@/lib/memoireLocale';
import { LIBELLE_POSTE, trierCategories } from '@/lib/postes';
import { formatHeure, useHistoriqueProduit } from '@/lib/useHistoriqueProduit';
import { useSaisieJournee, type Produit } from '@/lib/useSaisieJournee';

/** Le rayon que le manager planifie tous les jours. */
const RAYON_PRINCIPAL = 'Viennoiserie';

export default function SaisiePrevisions() {
  const [date, setDate] = useState(() => journeeProduction());
  const [recherche, setRecherche] = useState('');
  const [ouvertsManuellement, setOuvertsManuellement] = useMemoireLocale<string[]>(
    'boulangerie:rayons-previsions',
    [RAYON_PRINCIPAL]
  );

  const saisie = useSaisieJournee({ date, champ: 'quantitePrevue' });
  const { reperes } = useHistoriqueProduit(date);

  const enRecherche = recherche.trim().length > 0;

  /* ------------------------------------------------------------- Rayons */

  const rayons = useMemo(() => {
    const groupes = new Map<string, Produit[]>();
    const terme = recherche.trim().toLowerCase();

    for (const produit of saisie.produits) {
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
  }, [saisie.produits, saisie.valeurs, recherche]);

  // Un rayon qui contient déjà des quantités s'ouvre tout seul : le manager
  // doit voir ce qu'il a demandé, même dans un rayon qu'il ouvre rarement.
  const estOuvert = (categorie: string, remplis: number) =>
    enRecherche || remplis > 0 || ouvertsManuellement.includes(categorie);

  const basculer = (categorie: string) => {
    setOuvertsManuellement(
      ouvertsManuellement.includes(categorie)
        ? ouvertsManuellement.filter((c) => c !== categorie)
        : [...ouvertsManuellement, categorie]
    );
  };

  // Au premier chargement, seule la viennoiserie est dépliée.
  useEffect(() => {
    if (ouvertsManuellement.length === 0) setOuvertsManuellement([RAYON_PRINCIPAL]);
  }, [ouvertsManuellement, setOuvertsManuellement]);

  /* -------------------------------------------------- Aide à la décision */

  const appliquerLesReperes = (produits: Produit[]) => {
    for (const produit of produits) {
      if ((saisie.valeurs[produit.id] ?? '') !== '') continue;
      const moyenne = reperes.get(produit.id)?.moyenneProduite;
      if (moyenne != null && moyenne > 0) saisie.definir(produit.id, String(moyenne));
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

  return (
    <>
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

      <div className="sans-impression mb-4">
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Chercher un produit dans tous les rayons…"
          aria-label="Chercher un produit"
          className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none sm:max-w-80"
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
        <Chargement libelle="Chargement du catalogue…" />
      ) : rayons.length === 0 ? (
        <Carte>
          <EtatVide titre="Aucun produit ne correspond" detail="Essayez un autre mot." />
        </Carte>
      ) : (
        <div className="space-y-3">
          {rayons.map(({ categorie, produits, remplis }) => {
            const ouvert = estOuvert(categorie, remplis);
            const principal = categorie === RAYON_PRINCIPAL;
            const avecReperes = produits.filter(
              (p) => (reperes.get(p.id)?.moyenneProduite ?? 0) > 0
            ).length;

            return (
              <Carte key={categorie}>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => basculer(categorie)}
                    aria-expanded={ouvert}
                    className="flex min-w-0 items-center gap-2 text-left"
                  >
                    <span aria-hidden className="text-ink-3">
                      {ouvert ? '▾' : '▸'}
                    </span>
                    <span className="text-sm font-semibold text-ink">{categorie}</span>
                    {!principal && remplis === 0 ? (
                      <span className="text-xs text-ink-3">rarement planifié</span>
                    ) : null}
                  </button>

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
                        return (
                          <LigneSaisie
                            key={produit.id}
                            nom={produit.nom}
                            valeur={saisie.valeurs[produit.id] ?? ''}
                            onChange={(v) => saisie.definir(produit.id, v)}
                            suggestion={repere?.moyenneProduite ?? null}
                            onAppliquerSuggestion={
                              repere?.moyenneProduite != null
                                ? () => saisie.definir(produit.id, String(repere.moyenneProduite))
                                : undefined
                            }
                            indice={
                              repere?.dernier?.produite != null ? (
                                <>
                                  semaine passée :{' '}
                                  <span className="chiffres">{repere.dernier.produite} produits</span>
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
                                        {repere.dernier.restante} invendus
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
                              ) : null
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
    </>
  );
}
