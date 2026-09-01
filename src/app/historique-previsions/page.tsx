'use client';


import { dateDuJour, decalerJours } from '@/lib/dateProduction';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Produit {
  id: number;
  nom: string;
}

interface Inventaire {
  id: number;
  dateInventaire: string;
  quantiteRestante: number | null;
  quantiteProduite: number | null;
  quantitePrevue: number | null;
  produit: Produit;
}

interface PrevisionParDate {
  date: string;
  previsions: Inventaire[];
  totalPrevu: number;
  totalProduit: number;
  /** null tant qu'aucune production n'a été saisie pour cette journée. */
  precision: number | null;
  lignesProduites: number;
}

export default function HistoriquePrevisions() {
  const [previsions, setPrevisions] = useState<PrevisionParDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOuverte, setModalOuverte] = useState(false);
  const [dateSelectionnee, setDateSelectionnee] = useState('');
  const [previsionsDetail, setPrevisionsDetail] = useState<Inventaire[]>([]);

  useEffect(() => {
    chargerPrevisions();
  }, []);

  const chargerPrevisions = async () => {
    setLoading(true);
    try {
      // Charger tous les inventaires des 30 derniers jours
      // Bornée côté serveur, et filtrée sur les lignes qui ont une prévision.
      const debut = decalerJours(dateDuJour(), -90);
      const response = await fetch(`/api/inventaires?debut=${debut}&avecPrevision=1&limit=2000`);
      const data = await response.json();
      
      // Filtrer seulement ceux qui ont des prévisions
      const avecPrevisions = data.filter((inv: Inventaire) => inv.quantitePrevue && inv.quantitePrevue > 0);
      
      // Grouper par date
      const groupesParDate = avecPrevisions.reduce((acc: any, inv: Inventaire) => {
        const date = inv.dateInventaire;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(inv);
        return acc;
      }, {});

      const previsionsAvecStats = Object.keys(groupesParDate)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
        .slice(0, 15) // Dernières 15 dates avec prévisions
        .map(date => {
          const previsions = groupesParDate[date];
          return calculerStatsPrevision(date, previsions);
        });

      setPrevisions(previsionsAvecStats);
    } catch (error) {
      console.error('Erreur lors du chargement des prévisions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculerStatsPrevision = (date: string, previsions: Inventaire[]): PrevisionParDate => {
    const totalPrevu = previsions.reduce((sum, inv) => sum + (inv.quantitePrevue ?? 0), 0);
    const totalProduit = previsions.reduce((sum, inv) => sum + (inv.quantiteProduite ?? 0), 0);

    // La précision ne se calcule que sur les lignes réellement produites. Une
    // journée prévue mais pas encore saisie affichait « 0 % » en rouge, comme
    // si le fournil n'avait rien fait — alors qu'il n'a simplement pas encore
    // renseigné ses quantités.
    const produites = previsions.filter((inv) => inv.quantiteProduite != null);
    const prevuComptabilise = produites.reduce((sum, inv) => sum + (inv.quantitePrevue ?? 0), 0);
    const produitComptabilise = produites.reduce((sum, inv) => sum + (inv.quantiteProduite ?? 0), 0);

    const precision =
      produites.length === 0 || prevuComptabilise === 0
        ? null
        : Math.round((produitComptabilise / prevuComptabilise) * 100);

    return {
      date,
      previsions,
      totalPrevu,
      totalProduit,
      precision,
      lignesProduites: produites.length,
    };
  };

  const ouvrirModal = (date: string, previsions: Inventaire[]) => {
    setDateSelectionnee(date);
    setPrevisionsDetail(previsions);
    setModalOuverte(true);
  };

  const fermerModal = () => {
    setModalOuverte(false);
    setDateSelectionnee('');
    setPrevisionsDetail([]);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDateHier = (dateString: string) => {
    const date = new Date(dateString);
    date.setDate(date.getDate() - 1);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  return (
    <div className="min-h-screen bg-surface-2 py-4 px-4 sm:py-8 sm:px-6 lg:px-8">
      <div>
{/* En-tête */}
        <div className="bg-surface rounded-xl border border-line p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-ink">Historique des Prévisions</h1>
              <p className="text-ink-2">Analyse de la précision de vos planifications</p>
            </div>
            <div className="flex gap-2">
              <Link 
                href="/saisie-prevue"
                className="bg-accent hover:bg-accent text-white px-4 py-2 rounded-xl transition-colors duration-200 text-sm font-medium"
              >
                Nouvelle prévision
              </Link>
              <Link 
                href="/dashboard"
                className="bg-ink-3 hover:bg-ink-2 text-white px-4 py-2 rounded-xl transition-colors duration-200 text-sm font-medium"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Liste des prévisions */}
        <div className="bg-surface rounded-xl shadow-sm border border-line overflow-hidden">
          <div className="px-6 py-4 border-b border-line">
            <h2 className="text-xl font-semibold text-ink">Prévisions récentes</h2>
            <p className="text-sm text-ink-2 mt-1">Cliquez sur une date pour voir les détails</p>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-ink-3">Chargement...</p>
            </div>
          ) : previsions.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-6xl mb-4"></div>
              <h3 className="text-xl font-semibold text-ink-2 mb-2">Aucune prévision trouvée</h3>
              <p className="text-ink-3 mb-4">Commencez à planifier vos productions pour voir l'historique ici</p>
              <Link 
                href="/saisie-prevue"
                className="bg-accent hover:bg-accent text-white px-6 py-2 rounded-xl transition-colors"
              >
                Créer ma première prévision
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {previsions.map((previsionDate) => (
                <button
                  key={previsionDate.date}
                  onClick={() => ouvrirModal(previsionDate.date, previsionDate.previsions)}
                  className="w-full px-6 py-4 text-left hover:bg-surface-2 transition-colors focus:outline-none focus:bg-surface-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-medium text-ink">
                        {formatDate(previsionDate.date)}
                      </h3>
                      <p className="text-sm text-ink-2">
                        Prévu le {getDateHier(previsionDate.date)} • {previsionDate.previsions.length} produit(s)
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-accent-doux rounded-full"></span>
                        <span className="text-ink-2">Prévu: <span className="font-medium text-accent">{previsionDate.totalPrevu}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-ok-doux rounded-full"></span>
                        <span className="text-ink-2">Produit: <span className="font-medium text-ok">{previsionDate.totalProduit}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${
                          previsionDate.precision === null ? 'bg-line-fort' :
                          previsionDate.precision >= 90 ? 'bg-ok' :
                          previsionDate.precision >= 75 ? 'bg-attention' : 'bg-alerte'
                        }`}></span>
                        <span className="text-ink-2">
                          {previsionDate.precision === null ? (
                            <span className="text-ink-3">production pas encore saisie</span>
                          ) : (
                            <>Précision: <span className="font-medium">{previsionDate.precision}%</span></>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Liens de navigation */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            href="/planification-demain"
            className="inline-flex items-center justify-center bg-accent text-white px-6 py-3 rounded-md hover:bg-accent-fort font-medium transition-colors"
          >
            Planning actuel
          </Link>
          <Link
            href="/saisie-prevue"
            className="inline-flex items-center justify-center bg-accent text-white px-6 py-3 rounded-md hover:bg-accent-fort font-medium transition-colors"
          >
            Nouvelle prévision
          </Link>
        </div>
      </div>

      {/* Modal de détails */}
      {modalOuverte && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-ink">
                  Prévisions pour le {formatDate(dateSelectionnee)}
                </h3>
                <p className="text-sm text-ink-2">
                  Planifié le {getDateHier(dateSelectionnee)}
                </p>
              </div>
              <button
                onClick={fermerModal}
                className="text-ink-3 hover:text-ink-2 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-4">
                {previsionsDetail.map((inventaire) => {
                  const prevu = inventaire.quantitePrevue ?? 0;
                  const produitConnu = inventaire.quantiteProduite;
                  const produit = produitConnu ?? 0;
                  const precisionProduit =
                    produitConnu != null && prevu > 0 ? Math.round((produit / prevu) * 100) : null;
                  
                  return (
                    <div key={inventaire.id} className="bg-surface-2 rounded-xl p-4 border border-line">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium text-ink text-lg">
                          {inventaire.produit.nom}
                        </h4>
                        <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                          precisionProduit === null ? 'bg-surface-2 text-ink-3' :
                          precisionProduit >= 90 ? 'bg-ok-doux text-ok' :
                          precisionProduit >= 75 ? 'bg-attention-doux text-attention' :
                          'bg-alerte-doux text-alerte'
                        }`}>
                          {precisionProduit === null
                            ? 'production pas encore saisie'
                            : `${precisionProduit}% de précision`}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="bg-accent-doux p-3 rounded">
                          <p className="text-sm text-ink-2">Était prévu</p>
                          <p className="text-2xl font-bold text-accent">{prevu}</p>
                        </div>
                        <div className="bg-ok-doux p-3 rounded">
                          <p className="text-sm text-ink-2">Réellement produit</p>
                          <p className="text-2xl font-bold text-ok">{produitConnu ?? '—'}</p>
                        </div>
                      </div>
                      
                      {produitConnu != null ? (
                        <div className="mt-3 text-center">
                          <div className="bg-surface-2 p-2 rounded">
                            <p className="text-sm text-ink-2">
                              Écart&nbsp;: {produit - prevu > 0 ? '+' : ''}
                              {produit - prevu}
                              {produit - prevu > 0
                                ? ' (surproduction)'
                                : produit - prevu < 0
                                  ? ' (sous-production)'
                                  : ' (exactement la demande)'}
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
