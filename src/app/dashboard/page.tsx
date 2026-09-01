'use client';


import { dateDuJour, decalerJours } from '@/lib/dateProduction';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Produit {
  id: number;
  nom: string;
  ordre: number;
}

interface Inventaire {
  id: number;
  dateInventaire: string;
  quantiteRestante: number | null;
  quantiteProduite: number | null;
  quantitePrevue: number | null;
  produit: Produit;
}

interface DateInventaire {
  date: string;
  totalProduits: number;
  totalProduit: number;
  totalVendu: number;
  /** null tant qu'aucune ligne n'a à la fois le produit et le restant. */
  tauxVente: number | null;
  lignesCompletes: number;
}

export default function DashboardInventaires() {
  const [datesInventaires, setDatesInventaires] = useState<DateInventaire[]>([]);
  const [inventairesDetail, setInventairesDetail] = useState<Inventaire[]>([]);
  const [inventairesFiltres, setInventairesFiltres] = useState<Inventaire[]>([]);
  const [modalOuverte, setModalOuverte] = useState(false);
  const [dateSelectionnee, setDateSelectionnee] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filtreRecherche, setFiltreRecherche] = useState('');
  const [sectionAffichee, setSectionAffichee] = useState(0);

  useEffect(() => {
    loadDatesInventaires();
  }, []);

  const loadDatesInventaires = async () => {
    setLoading(true);
    try {
      // Les 60 derniers jours, bornés côté serveur.
      const debut = decalerJours(dateDuJour(), -60);
      const response = await fetch(`/api/inventaires?debut=${debut}&limit=2000`);
      const data = await response.json();
      
      // Grouper par date et calculer les stats
      const groupesParDate = data.reduce((acc: any, inv: Inventaire) => {
        const date = String(inv.dateInventaire).slice(0, 10);
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(inv);
        return acc;
      }, {});

      const datesAvecStats = Object.keys(groupesParDate)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
        .slice(0, 10) // Dernières 10 dates
        .map(date => {
          const inventaires = groupesParDate[date];
          return calculerStatsDate(date, inventaires);
        });

      setDatesInventaires(datesAvecStats);
    } catch (error) {
      console.error('Erreur lors du chargement des dates:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculerStatsDate = (date: string, inventaires: Inventaire[]): DateInventaire => {
    const totalProduit = inventaires.reduce((sum, inv) => sum + (inv.quantiteProduite ?? 0), 0);

    // Le vendu ne se calcule que sur les lignes où l'on connaît À LA FOIS le
    // produit et le restant. Traiter un « pas encore compté » comme un zéro
    // faisait afficher 100 % de vente sur une journée non comptée — le pire
    // des chiffres, faux et rassurant.
    const lignesCompletes = inventaires.filter(
      (inv) => inv.quantiteProduite != null && inv.quantiteRestante != null
    );
    const produitComptabilise = lignesCompletes.reduce(
      (sum, inv) => sum + (inv.quantiteProduite ?? 0),
      0
    );
    const totalVendu = lignesCompletes.reduce(
      (sum, inv) => sum + Math.max(0, (inv.quantiteProduite ?? 0) - (inv.quantiteRestante ?? 0)),
      0
    );

    const tauxVente =
      produitComptabilise > 0 ? Math.round((totalVendu / produitComptabilise) * 100) : null;

    return {
      date,
      totalProduits: inventaires.length,
      totalProduit,
      totalVendu,
      tauxVente,
      lignesCompletes: lignesCompletes.length,
    };
  };

  const ouvrirModal = async (date: string) => {
    setDateSelectionnee(date);
    setModalOuverte(true);
    setLoadingDetail(true);
    
    try {
      // L'API n'accepte que YYYY-MM-DD. Un horodatage ISO complet est rejeté
      // silencieusement : le filtre de date saute et la fenêtre affiche toutes
      // les journées confondues, chaque produit en plusieurs exemplaires.
      const jour = String(date).slice(0, 10);
      const response = await fetch(`/api/inventaires?date=${jour}`);
      const data = await response.json();
      
      // Trier les inventaires par ordre des produits comme dans la saisie vendeur
      const inventairesTries = data.sort((a: Inventaire, b: Inventaire) => {
        const ordreA = a.produit?.ordre || 0;
        const ordreB = b.produit?.ordre || 0;
        return ordreA - ordreB;
      });
      
      setInventairesDetail(inventairesTries);
      setInventairesFiltres(inventairesTries);
      setFiltreRecherche('');
      setSectionAffichee(0);
    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const fermerModal = () => {
    setModalOuverte(false);
    setDateSelectionnee('');
    setInventairesDetail([]);
    setInventairesFiltres([]);
    setFiltreRecherche('');
    setSectionAffichee(0);
  };

  // Fonction de filtrage des produits
  const filtrerProduits = (recherche: string) => {
    setFiltreRecherche(recherche);
    setSectionAffichee(0); // Revenir au début quand on filtre
    
    if (!recherche.trim()) {
      setInventairesFiltres(inventairesDetail);
      return;
    }
    
    const produitsFiltres = inventairesDetail.filter(inventaire =>
      inventaire.produit.nom.toLowerCase().includes(recherche.toLowerCase())
    );
    setInventairesFiltres(produitsFiltres);
  };

  // Diviser les produits en sections de 15 éléments
  const PRODUITS_PAR_SECTION = 15;
  const nombreSections = Math.ceil(inventairesFiltres.length / PRODUITS_PAR_SECTION);
  const produitsSection = inventairesFiltres.slice(
    sectionAffichee * PRODUITS_PAR_SECTION,
    (sectionAffichee + 1) * PRODUITS_PAR_SECTION
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-surface-2 py-4 px-4 sm:py-8 sm:px-6 lg:px-8">
      <div>
{/* En-tête */}
        <div className="bg-surface rounded-xl border border-line p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-ink">Dashboard Inventaires</h1>
              <p className="text-ink-2">Aperçu des performances par date</p>
            </div>
            <div className="flex gap-2">
              <Link 
                href="/historique-previsions"
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl transition-colors duration-200 text-sm font-medium"
              >
                Historique
              </Link>
              <Link 
                href="/planification-demain"
                className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-xl transition-colors duration-200 text-sm font-medium"
              >
                Planification
              </Link>
              <Link 
                href="/"
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-xl transition-colors duration-200 text-sm font-medium"
              >
                Retour
              </Link>
            </div>
          </div>
        </div>

        {/* Liste des dates d'inventaire */}
        <div className="bg-surface rounded-xl shadow-sm border border-line overflow-hidden">
          <div className="px-6 py-4 border-b border-line">
            <h2 className="text-xl font-semibold text-ink">Inventaires récents</h2>
            <p className="text-sm text-ink-2 mt-1">Cliquez sur une date pour voir les détails</p>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-ink-3">Chargement...</p>
            </div>
          ) : datesInventaires.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-ink-3">Aucun inventaire trouvé</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {datesInventaires.map((dateInv) => (
                <button
                  key={dateInv.date}
                  onClick={() => ouvrirModal(dateInv.date)}
                  className="w-full px-6 py-4 text-left hover:bg-surface-2 transition-colors focus:outline-none focus:bg-surface-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-medium text-ink">
                        {formatDate(dateInv.date)}
                      </h3>
                      <p className="text-sm text-ink-2">
                        {dateInv.totalProduits} produit(s) inventorié(s)
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-ok-doux rounded-full"></span>
                        <span className="text-ink-2">Produit: <span className="font-medium text-ok">{dateInv.totalProduit}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-accent-doux rounded-full"></span>
                        <span className="text-ink-2">Vendu: <span className="font-medium text-accent">{dateInv.totalVendu}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${
                          dateInv.tauxVente === null ? 'bg-line-fort' :
                          dateInv.tauxVente >= 80 ? 'bg-ok' :
                          dateInv.tauxVente >= 60 ? 'bg-attention' : 'bg-alerte'
                        }`}></span>
                        <span className="text-ink-2">
                          {dateInv.tauxVente === null ? (
                            <span className="text-ink-3">comptage incomplet</span>
                          ) : (
                            <>Taux: <span className="font-medium">{dateInv.tauxVente}%</span></>
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
            href="/inventaire"
            className="inline-flex items-center justify-center bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 font-medium transition-colors"
          >
            Nouvelle saisie d'inventaire
          </Link>
          <Link
            href="/test-api"
            className="inline-flex items-center justify-center bg-accent text-white px-6 py-3 rounded-md hover:bg-accent-fort font-medium transition-colors"
          >
            Gérer les produits
          </Link>
        </div>
      </div>

      {/* Modal de détails */}
      {modalOuverte && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-ink">
                  Détails du {formatDate(dateSelectionnee)}
                </h3>
                <p className="text-sm text-ink-2 mt-1">
                  {inventairesFiltres.length} produit(s) {filtreRecherche && 'trouvé(s)'}
                </p>
              </div>
              <button
                onClick={fermerModal}
                className="text-ink-3 hover:text-ink-2 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            {/* Barre de recherche */}
            <div className="px-6 py-4 border-b border-line bg-surface-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={filtreRecherche}
                  onChange={(e) => filtrerProduits(e.target.value)}
                  className="w-full px-4 py-2 pl-10 border border-line rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {filtreRecherche && (
                  <button
                    onClick={() => filtrerProduits('')}
                    title="Effacer la recherche"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-3 hover:text-ink-2"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Navigation sections */}
            {nombreSections > 1 && (
              <div className="px-6 py-3 border-b border-line bg-accent-doux">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSectionAffichee(Math.max(0, sectionAffichee - 1))}
                      disabled={sectionAffichee === 0}
                      className="px-3 py-1 rounded bg-blue-500 hover:bg-accent text-white disabled:bg-gray-300 disabled:text-ink-3 text-sm font-medium transition-colors"
                    >
                      Précédent
                    </button>
                    <span className="px-3 py-1 text-sm font-medium text-ink-2">
                      Section {sectionAffichee + 1} / {nombreSections}
                    </span>
                    <button
                      onClick={() => setSectionAffichee(Math.min(nombreSections - 1, sectionAffichee + 1))}
                      disabled={sectionAffichee === nombreSections - 1}
                      className="px-3 py-1 rounded bg-blue-500 hover:bg-accent text-white disabled:bg-gray-300 disabled:text-ink-3 text-sm font-medium transition-colors"
                    >
                      Suivant 
                    </button>
                  </div>
                  <div className="text-sm text-ink-2">
                    Produits {sectionAffichee * PRODUITS_PAR_SECTION + 1} à {Math.min((sectionAffichee + 1) * PRODUITS_PAR_SECTION, inventairesFiltres.length)} sur {inventairesFiltres.length}
                  </div>
                </div>
              </div>
            )}
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {loadingDetail ? (
                <div className="text-center py-8">
                  <p className="text-ink-3">Chargement des détails...</p>
                </div>
              ) : inventairesFiltres.length === 0 && filtreRecherche ? (
                <div className="text-center py-8">
                  <p className="text-ink-3">Aucun produit trouvé pour "{filtreRecherche}"</p>
                  <button
                    onClick={() => filtrerProduits('')}
                    className="mt-2 text-accent hover:text-accent underline"
                  >
                    Effacer le filtre
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {produitsSection.map((inventaire) => {
                    // Sans les deux valeurs, le vendu est inconnu — pas zéro.
                    const complet =
                      inventaire.quantiteProduite != null && inventaire.quantiteRestante != null;
                    const produit = inventaire.quantiteProduite ?? 0;
                    const restant = inventaire.quantiteRestante;
                    const vendu = complet ? Math.max(0, produit - (restant ?? 0)) : null;
                    const tauxVente =
                      complet && produit > 0 ? Math.round(((vendu ?? 0) / produit) * 100) : null;
                    
                    return (
                      <div key={inventaire.id} className="bg-surface-2 rounded-xl p-4 border border-line">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-ink text-lg">
                            {inventaire.produit.nom}
                          </h4>
                          <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                            tauxVente === null ? 'bg-surface-2 text-ink-3' :
                            tauxVente >= 80 ? 'bg-ok-doux text-ok' :
                            tauxVente >= 60 ? 'bg-attention-doux text-attention' :
                            'bg-alerte-doux text-alerte'
                          }`}>
                            {tauxVente === null ? 'pas encore compté' : `${tauxVente}% vendu`}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="bg-ok-doux p-3 rounded">
                            <p className="text-sm text-ink-2">Produit</p>
                            <p className="text-xl font-bold text-ok">{produit}</p>
                          </div>
                          <div className="bg-accent-doux p-3 rounded">
                            <p className="text-sm text-ink-2">Vendu</p>
                            <p className="text-xl font-bold text-accent">{vendu ?? '—'}</p>
                          </div>
                          <div className="bg-attention-doux p-3 rounded">
                            <p className="text-sm text-ink-2">Restant</p>
                            <p className="text-xl font-bold text-attention">{restant ?? '—'}</p>
                          </div>
                        </div>
                        {inventaire.quantitePrevue != null && (
                          <div className="mt-3 bg-accent-doux p-3 rounded">
                            <p className="text-sm text-ink-2">Était prévu pour ce jour</p>
                            <p className="text-lg font-medium text-accent">{inventaire.quantitePrevue}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Navigation en bas de section */}
                  {nombreSections > 1 && (
                    <div className="pt-4 border-t border-line">
                      <div className="flex items-center justify-center space-x-4">
                        <button
                          onClick={() => setSectionAffichee(0)}
                          disabled={sectionAffichee === 0}
                          className="px-3 py-2 rounded bg-blue-500 hover:bg-accent text-white disabled:bg-gray-300 disabled:text-ink-3 text-sm font-medium transition-colors"
                        >
                          Début
                        </button>
                        <button
                          onClick={() => setSectionAffichee(Math.max(0, sectionAffichee - 1))}
                          disabled={sectionAffichee === 0}
                          className="px-3 py-2 rounded bg-blue-500 hover:bg-accent text-white disabled:bg-gray-300 disabled:text-ink-3 text-sm font-medium transition-colors"
                        >
                          Précédent
                        </button>
                        <span className="px-4 py-2 text-sm font-medium text-ink-2 bg-surface-2 rounded">
                          {sectionAffichee + 1} / {nombreSections}
                        </span>
                        <button
                          onClick={() => setSectionAffichee(Math.min(nombreSections - 1, sectionAffichee + 1))}
                          disabled={sectionAffichee === nombreSections - 1}
                          className="px-3 py-2 rounded bg-blue-500 hover:bg-accent text-white disabled:bg-gray-300 disabled:text-ink-3 text-sm font-medium transition-colors"
                        >
                          Suivant 
                        </button>
                        <button
                          onClick={() => setSectionAffichee(nombreSections - 1)}
                          disabled={sectionAffichee === nombreSections - 1}
                          className="px-3 py-2 rounded bg-blue-500 hover:bg-accent text-white disabled:bg-gray-300 disabled:text-ink-3 text-sm font-medium transition-colors"
                        >
                          Fin
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
