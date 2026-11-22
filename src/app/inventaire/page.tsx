'use client';

// Vue complète d'une journée : demandé, produit, restant, vendu.
// C'est le filet de sécurité mentionné par le client — tout est là,
// sur un seul écran, en lecture et en correction.
//
// LOI 2 : un produit au kilo a ses quantités en grammes, affichées en kg, et
// n'entre jamais dans les totaux en pièces (on n'additionne pas des grammes
// et des pièces). LOI 10 : seuls les produits de la liste d'inventaire.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alerte, Carte, Chargement, Entete, EtatVide, Puce } from '@/components/ui';
import { BandeSemaine } from '@/components/BandeSemaine';
import { bilanJournee } from '@/domaine/bilanInventaire';
import { dateDuJour, decalerJours, formatDateLong } from '@/lib/dateProduction';
import { trierCategories } from '@/lib/postes';
import { RappelChargement } from '@/components/rappels';
import { formaterQuantite } from '@/domaine/unites';
import type { Unite } from '@/domaine/types';

type Ligne = {
  produitId: number;
  quantitePrevue: number | null;
  quantiteProduite: number | null;
  quantiteRestante: number | null;
  produit: { id: number; nom: string; categorie: string; ordre: number; unite?: Unite };
};

/** Colonnes qu'on peut afficher (22/11/2026) : seul « Restant » au départ — les ventes viendront plus tard. */
const COLONNES = [
  { id: 'demande', libelle: 'Demandé' },
  { id: 'produit', libelle: 'Produit' },
  { id: 'restant', libelle: 'Restant' },
  { id: 'vendu', libelle: 'Vendu' },
] as const;
type IdColonne = (typeof COLONNES)[number]['id'];
const COLONNES_PAR_DEFAUT: Record<IdColonne, boolean> = { demande: false, produit: false, restant: true, vendu: false };
const CLE_STOCKAGE = 'inventaire-journee:colonnes';

const afficher = (v: number | null, unite: Unite = 'piece') =>
  v === null ? (
    <span className="text-ink-3">—</span>
  ) : (
    <span className="chiffres">{unite === 'kg' ? formaterQuantite('kg', v) : v}</span>
  );

export default function InventaireComplet() {
  const [date, setDate] = useState(() => dateDuJour());
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  // Bande de la semaine (21/11/2026) : les 7 soirs qui finissent aujourd'hui, restes comptés par soir.
  const [debutSemaine, setDebutSemaine] = useState(0);
  const [semaineLignes, setSemaineLignes] = useState<Ligne[]>([]);
  const aujourdhui = dateDuJour();
  const jours = Array.from({ length: 7 }, (_, k) => decalerJours(aujourdhui, debutSemaine * 7 - 6 + k));
  const premierJour = jours[0];
  const dernierJour = jours[6];
  // Colonnes choisies : retenues sur la tablette (jamais bloquant si le stockage est refusé).
  const [colonnes, setColonnes] = useState<Record<IdColonne, boolean>>(COLONNES_PAR_DEFAUT);
  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(CLE_STOCKAGE);
      if (!brut) return;
      const lu = JSON.parse(brut) as Partial<Record<IdColonne, unknown>>;
      const suite = { ...COLONNES_PAR_DEFAUT };
      for (const c of COLONNES) if (typeof lu[c.id] === 'boolean') suite[c.id] = lu[c.id] as boolean;
      if (COLONNES.some((c) => suite[c.id])) setColonnes(suite);
    } catch {
      /* rien : on garde le choix par défaut */
    }
  }, []);
  const basculer = (id: IdColonne) => {
    const suite = { ...colonnes, [id]: !colonnes[id] };
    if (!COLONNES.some((c) => suite[c.id])) return; // au moins une colonne
    setColonnes(suite);
    try {
      window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(suite));
    } catch {
      /* stockage refusé : le choix vaut pour cette visite */
    }
  };
  const nbColonnes = COLONNES.filter((c) => colonnes[c.id]).length;
  const auPoids = lignes.some((l) => l.produit.unite === 'kg');

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

  useEffect(() => {
    let vivant = true;
    fetch(`/api/inventaires?debut=${premierJour}&fin=${dernierJour}&limit=2000`)
      .then((r) => (r.ok ? r.json() : []))
      .then((l: (Ligne & { dateInventaire?: string })[]) => {
        if (vivant && Array.isArray(l)) setSemaineLignes(l);
      })
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [premierJour, dernierJour]);

  const bilanDuSoir = (iso: string) => {
    const duSoir = (semaineLignes as (Ligne & { dateInventaire?: string })[]).filter((l) => String(l.dateInventaire).slice(0, 10) === iso);
    return duSoir.length === 0
      ? null
      : bilanJournee(duSoir.map((l) => ({ nom: l.produit.nom, quantiteRestante: l.quantiteRestante, quantiteProduite: l.quantiteProduite, unite: l.produit.unite })));
  };

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
      if (l.produit.unite === 'kg') continue; // totaux en pièces uniquement
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
      />

      <BandeSemaine
        titre="Soirs de la semaine"
        jours={jours}
        aujourdhui={aujourdhui}
        choisi={date}
        onChoisir={setDate}
        onPrecedente={() => setDebutSemaine((d) => d - 1)}
        onSuivante={() => setDebutSemaine((d) => d + 1)}
        onRetourAujourdhui={debutSemaine !== 0 ? () => setDebutSemaine(0) : null}
        peutSuivante={debutSemaine < 0}
        cellule={(iso) => {
          const b = bilanDuSoir(iso);
          const compte = b !== null && b.restesComptes > 0;
          return {
            libelle: `${formatDateLong(iso)} : ${compte ? `${b.resteTotalPieces ?? 0} pièces restées` : 'pas encore compté'}`,
            bas: compte ? (b.resteTotalPieces ?? 0) : undefined,
            point: compte && b.aZero.length > 0,
          };
        }}
        note="Pièces restées en rayon chaque soir · un point = au moins un produit à zéro."
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
        <>
          <Chargement />
          <RappelChargement className="mx-auto max-w-md" />
        </>
      ) : lignes.length === 0 ? (
        <Carte>
          <EtatVide
            titre="Rien n'a encore été saisi pour cette journée"
            detail="Les quantités apparaîtront ici dès la première saisie."
          />
        </Carte>
      ) : (
        <>
          <fieldset className="mb-4">
            <legend className="mb-2 text-sm font-semibold text-ink-2">Colonnes à voir</legend>
            <div className="flex flex-wrap gap-2">
              {COLONNES.map((c) => (
                <label
                  key={c.id}
                  className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-2xl px-4 text-base font-medium ${colonnes[c.id] ? 'bg-accent-doux text-accent' : 'bg-segment-fond text-ink-2'}`}
                >
                  <input type="checkbox" checked={colonnes[c.id]} onChange={() => basculer(c.id)} className="h-5 w-5 accent-[var(--accent)]" />
                  {c.libelle}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mb-4 flex gap-3">
            {[
              { id: 'produit', libelle: 'Produit', valeur: totaux.produit },
              { id: 'vendu', libelle: 'Vendu', valeur: totaux.vendu, accent: true },
              { id: 'restant', libelle: 'Restant', valeur: totaux.restant },
            ]
              .filter((c) => colonnes[c.id as IdColonne])
              .map(({ libelle, valeur, accent }) => (
              <Carte key={libelle} className="flex-1 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-ink-3">
                  {libelle}
                  {auPoids ? <span className="normal-case"> · pièces</span> : null}
                </div>
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
                  <table className="w-full text-base">
                    <thead>
                      <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-3">
                        <th scope="col" className="px-4 py-2 text-left font-medium">Produit</th>
                        {colonnes.demande ? <th scope="col" className="px-3 py-2 text-right font-medium">Demandé</th> : null}
                        {colonnes.produit ? <th scope="col" className="px-3 py-2 text-right font-medium">Produit</th> : null}
                        {colonnes.restant ? <th scope="col" className="px-3 py-2 text-right font-medium">Restant</th> : null}
                        {colonnes.vendu ? <th scope="col" className="px-4 py-2 text-right font-medium">Vendu</th> : null}
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
                            <td className="px-4 py-3 text-ink">{ligne.produit.nom}</td>
                            {colonnes.demande ? (
                              <td className="px-3 py-3 text-right text-ink-2">{afficher(ligne.quantitePrevue, ligne.produit.unite)}</td>
                            ) : null}
                            {colonnes.produit ? (
                              <td className="px-3 py-3 text-right text-ink-2">{afficher(ligne.quantiteProduite, ligne.produit.unite)}</td>
                            ) : null}
                            {colonnes.restant ? (
                              <td className={`px-3 py-3 text-right text-lg font-medium ${invenduFort ? 'text-attention' : 'text-ink'}`}>
                                {afficher(ligne.quantiteRestante, ligne.produit.unite)}
                              </td>
                            ) : null}
                            {colonnes.vendu ? (
                              <td className="px-4 py-3 text-right font-medium text-ink">{afficher(vendu, ligne.produit.unite)}</td>
                            ) : null}
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
