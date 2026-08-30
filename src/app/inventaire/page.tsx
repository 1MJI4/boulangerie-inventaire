'use client';

// Vue complète d'une journée : demandé, produit, restant, vendu.
// C'est le filet de sécurité mentionné par le client — tout est là,
// sur un seul écran, en lecture et en correction.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alerte, Carte, Chargement, Entete, EtatVide, Puce } from '@/components/ui';
import { SelecteurJournee } from '@/components/SelecteurJournee';
import { dateDuJour, formatDateLong } from '@/lib/dateProduction';
import { trierCategories } from '@/lib/postes';

type Ligne = {
  produitId: number;
  quantitePrevue: number | null;
  quantiteProduite: number | null;
  quantiteRestante: number | null;
  produit: { id: number; nom: string; categorie: string; ordre: number };
};

const afficher = (v: number | null) =>
  v === null ? <span className="text-ink-3">—</span> : <span className="chiffres">{v}</span>;

export default function InventaireComplet() {
  const [date, setDate] = useState(() => dateDuJour());
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const reponse = await fetch(`/api/inventaires?date=${date}`);
      if (!reponse.ok) throw new Error();
      setLignes(await reponse.json());
    } catch {
      setErreur("Impossible de charger l'inventaire de cette journée.");
    } finally {
      setChargement(false);
    }
  }, [date]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const parCategorie = useMemo(() => {
    const groupes = new Map<string, Ligne[]>();
    for (const ligne of [...lignes].sort((a, b) => a.produit.ordre - b.produit.ordre)) {
      const liste = groupes.get(ligne.produit.categorie) ?? [];
      liste.push(ligne);
      groupes.set(ligne.produit.categorie, liste);
    }
    return trierCategories([...groupes.keys()]).map((c) => [c, groupes.get(c)!] as const);
  }, [lignes]);

  const totaux = useMemo(() => {
    let produit = 0;
    let restant = 0;
    let vendu = 0;
    for (const l of lignes) {
      produit += l.quantiteProduite ?? 0;
      restant += l.quantiteRestante ?? 0;
      if (l.quantiteProduite != null && l.quantiteRestante != null) {
        vendu += Math.max(0, l.quantiteProduite - l.quantiteRestante);
      }
    }
    return { produit, restant, vendu };
  }, [lignes]);

  return (
    <>
      <Entete
        titre="Inventaire de la journée"
        sousTitre={<span className="capitalize">{formatDateLong(date)}</span>}
        actions={<SelecteurJournee date={date} onChange={setDate} />}
      />

      {erreur ? (
        <Alerte>
          {erreur}{' '}
          <button onClick={() => void charger()} className="underline underline-offset-2">
            Réessayer
          </button>
        </Alerte>
      ) : null}

      {chargement ? (
        <Chargement />
      ) : lignes.length === 0 ? (
        <Carte>
          <EtatVide
            titre="Rien n'a encore été saisi pour cette journée"
            detail="Les quantités apparaîtront ici dès la première saisie."
          />
        </Carte>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            {[
              { libelle: 'Produit', valeur: totaux.produit },
              { libelle: 'Vendu', valeur: totaux.vendu, accent: true },
              { libelle: 'Restant', valeur: totaux.restant },
            ].map(({ libelle, valeur, accent }) => (
              <Carte key={libelle} className="px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-ink-3">{libelle}</div>
                <div
                  className={`chiffres mt-1 text-2xl font-semibold ${accent ? 'text-accent' : 'text-ink'}`}
                >
                  {valeur}
                </div>
              </Carte>
            ))}
          </div>

          <div className="space-y-4">
            {parCategorie.map(([categorie, liste]) => (
              <Carte key={categorie} className="overflow-hidden">
                <h2 className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
                  {categorie}
                </h2>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[26rem] text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-3">
                        <th scope="col" className="px-4 py-2 text-left font-medium">Produit</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Demandé</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Produit</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Restant</th>
                        <th scope="col" className="px-4 py-2 text-right font-medium">Vendu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liste.map((ligne) => {
                        const vendu =
                          ligne.quantiteProduite != null && ligne.quantiteRestante != null
                            ? Math.max(0, ligne.quantiteProduite - ligne.quantiteRestante)
                            : null;
                        const invenduFort =
                          ligne.quantiteProduite != null &&
                          ligne.quantiteRestante != null &&
                          ligne.quantiteProduite > 0 &&
                          ligne.quantiteRestante / ligne.quantiteProduite > 0.25;

                        return (
                          <tr key={ligne.produitId} className="border-b border-line last:border-b-0">
                            <td className="max-w-[14rem] truncate px-4 py-2 text-ink">
                              {ligne.produit.nom}
                            </td>
                            <td className="px-3 py-2 text-right text-ink-2">
                              {afficher(ligne.quantitePrevue)}
                            </td>
                            <td className="px-3 py-2 text-right text-ink-2">
                              {afficher(ligne.quantiteProduite)}
                            </td>
                            <td
                              className={`px-3 py-2 text-right ${invenduFort ? 'text-attention' : 'text-ink-2'}`}
                            >
                              {afficher(ligne.quantiteRestante)}
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-ink">
                              {afficher(vendu)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Carte>
            ))}
          </div>

          <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <Puce>—</Puce> signifie « pas encore compté », à ne pas confondre avec 0.
          </p>
        </>
      )}
    </>
  );
}
