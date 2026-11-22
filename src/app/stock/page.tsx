'use client';

// Stock de la feuille de commande (propriétaire, 22/11/2026) : farines, congelé,
// sacs à pain, emballages, entretien. On compte la quantité RESTANTE, par
// catégorie (onglets du haut), aussi simplement que les invendus. Une case vide
// = « pas encore compté » ; 0 = « il n'en reste plus ». Liste propre (LOI 10).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alerte, Bouton, Carte, Chargement, Entete, EtatVide } from '@/components/ui';
import { dateDuJour, formatDateLong } from '@/lib/dateProduction';
import { partagerPdfStock } from '@/lib/stockPdf';

type Article = { id: number; nom: string; categorie: string; ordre: number; quantite: number | null };

export default function StockPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [saisies, setSaisies] = useState<Record<number, string>>({});
  const [categorie, setCategorie] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);
  const [partage, setPartage] = useState<string | null>(null);
  const [preparation, setPreparation] = useState(false);
  const date = dateDuJour();

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const r = await fetch(`/api/stock?date=${date}`);
      if (!r.ok) throw new Error();
      const { articles: liste } = (await r.json()) as { articles: Article[] };
      setArticles(liste);
      setSaisies(Object.fromEntries(liste.map((a) => [a.id, a.quantite === null ? '' : String(a.quantite)])));
      setCategorie((c) => c ?? liste[0]?.categorie ?? null);
    } catch {
      setErreur('Impossible de charger le stock. Vérifiez la connexion puis réessayez.');
    } finally {
      setChargement(false);
    }
  }, [date]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const categories = useMemo(() => [...new Set(articles.map((a) => a.categorie))], [articles]);
  const visibles = articles.filter((a) => a.categorie === categorie);
  const modifies = articles.filter((a) => (a.quantite === null ? '' : String(a.quantite)) !== (saisies[a.id] ?? ''));
  const comptes = (c: string) => articles.filter((a) => a.categorie === c && (saisies[a.id] ?? '') !== '').length;
  const total = (c: string) => articles.filter((a) => a.categorie === c).length;

  async function enregistrer() {
    setEnvoi(true);
    setErreur(null);
    setEnregistre(false);
    try {
      const r = await fetch('/api/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, lignes: modifies.map((a) => ({ articleId: a.id, quantite: (saisies[a.id] ?? '').trim() })) }),
      });
      if (!r.ok) {
        const corps = (await r.json().catch(() => null)) as { message?: string } | null;
        setErreur(corps?.message ?? "L'enregistrement a échoué. Réessayez.");
        return;
      }
      setArticles((liste) => liste.map((a) => ({ ...a, quantite: (saisies[a.id] ?? '').trim() === '' ? null : Number(saisies[a.id]) })));
      setEnregistre(true);
    } catch {
      setErreur("Pas de connexion : rien n'a été enregistré. Réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  /** PDF propre de TOUT le stock (cases tapées comprises, même pas encore enregistrées). */
  async function envoyer() {
    setPreparation(true);
    setErreur(null);
    setPartage(null);
    try {
      const liste = articles.map((a) => {
        const t = (saisies[a.id] ?? '').trim();
        return { nom: a.nom, categorie: a.categorie, quantite: t === '' ? null : Number(t) };
      });
      const r = await partagerPdfStock(liste, date, formatDateLong(date));
      if (r === 'telecharge') setPartage('PDF téléchargé : joignez-le dans WhatsApp.');
    } catch {
      setErreur("Impossible de préparer le PDF. Réessayez.");
    } finally {
      setPreparation(false);
    }
  }

  return (
    <>
      <Entete titre="Stock" sousTitre={<span className="capitalize">{formatDateLong(date)} · quantité restante</span>} />

      {erreur ? (
        <Alerte>
          {erreur}{' '}
          {articles.length === 0 ? (
            <button onClick={() => void charger()} className="underline underline-offset-2">
              Réessayer
            </button>
          ) : null}
        </Alerte>
      ) : null}

      {chargement ? (
        <Chargement />
      ) : articles.length === 0 ? (
        <Carte>
          <EtatVide titre="Aucun article en stock" detail="La liste est vide." />
        </Carte>
      ) : (
        <>
          <div role="tablist" aria-label="Catégories" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
            {categories.map((c) => (
              <button
                key={c}
                role="tab"
                aria-selected={c === categorie}
                onClick={() => setCategorie(c)}
                className={`min-h-11 shrink-0 rounded-full px-4 text-[15px] font-semibold ${c === categorie ? 'bg-accent text-accent-texte' : 'bg-segment-fond text-ink'}`}
              >
                {c} <span className="chiffres text-[13px] opacity-70">{comptes(c)}/{total(c)}</span>
              </button>
            ))}
          </div>

          <Carte className="overflow-hidden">
            <ul className="divide-y divide-line">
              {visibles.map((a) => (
                <li key={a.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <label htmlFor={`stock-${a.id}`} className="min-w-0 flex-1 text-[16px] text-ink">
                    {a.nom}
                  </label>
                  <input
                    id={`stock-${a.id}`}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="—"
                    value={saisies[a.id] ?? ''}
                    onChange={(e) => {
                      setEnregistre(false);
                      setSaisies((s) => ({ ...s, [a.id]: e.target.value.replace(/\D/g, '').slice(0, 6) }));
                    }}
                    onFocus={(e) => e.currentTarget.select()}
                    className="chiffres h-11 w-24 rounded-xl border border-line bg-segment-fond px-3 text-right text-xl font-semibold text-ink placeholder:text-ink-3"
                  />
                </li>
              ))}
            </ul>
          </Carte>

          <div className="mt-4 flex flex-wrap items-center gap-3 pb-28">
            <Bouton variante="principal" onClick={() => void enregistrer()} disabled={envoi || modifies.length === 0}>
              {envoi ? 'Enregistrement…' : modifies.length > 0 ? `Enregistrer (${modifies.length})` : 'Enregistrer'}
            </Bouton>
            <Bouton onClick={() => void envoyer()} disabled={preparation}>
              {preparation ? 'Préparation…' : 'Envoyer par WhatsApp'}
            </Bouton>
            {enregistre ? <span className="text-sm text-ok">Enregistré ✓</span> : null}
            {partage ? <span className="text-sm text-ink-2">{partage}</span> : null}
          </div>
        </>
      )}
    </>
  );
}
