'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Produit {
  id: string;
  nom: string;
  ordre: number;
}

interface Inventaire {
  produitId: string;
  quantiteRestante: number | string;
}

export default function SaisieVendeur() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [inventaires, setInventaires] = useState<Inventaire[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedInput, setSelectedInput] = useState<string | null>(null);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20); // 20 produits par page
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSavedPage, setLastSavedPage] = useState<number | null>(null);
  const [savedPages, setSavedPages] = useState<Set<number>>(new Set());
  const [modifiedSinceLastSave, setModifiedSinceLastSave] = useState<Set<number>>(new Set());

  // Fonction pour charger les données
  const chargerDonnees = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Charger les produits
      const produitsResponse = await fetch('/api/produits');
      const produitsData = await produitsResponse.json();
      setProduits(produitsData.sort((a: Produit, b: Produit) => a.ordre - b.ordre));
      
      // Charger les inventaires du jour
      const inventairesResponse = await fetch(`/api/inventaires?date=${today}`);
      const inventairesData = await inventairesResponse.json();
      
      // Initialiser les inventaires avec les données existantes ou des valeurs par défaut
      const inventairesInitiaux = produitsData.map((produit: Produit) => {
        const inventaireExistant = inventairesData.find((inv: any) => inv.produitId === produit.id);
        return {
          produitId: produit.id,
          quantiteRestante: inventaireExistant ? inventaireExistant.quantiteRestante : ''
        };
      });
      
      setInventaires(inventairesInitiaux);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      setMessage('❌ Erreur lors du chargement des données');
    }
  };

  useEffect(() => {
    chargerDonnees();
  }, []);

  const updateQuantite = (produitId: string, quantite: number | string) => {
    setInventaires(prev => 
      prev.map(inv => 
        inv.produitId === produitId 
          ? { ...inv, quantiteRestante: quantite }
          : inv
      )
    );
    
    // Marquer la page actuelle comme modifiée
    setModifiedSinceLastSave(prev => new Set([...prev, currentPage]));
  };

  // Sauvegarde automatique d'une page
  const autoSavePage = async (pageInventaires: Inventaire[], pageNumber: number) => {
    setAutoSaving(true);
    try {
      const inventairesToSave = pageInventaires.map(inv => ({
        produitId: inv.produitId,
        quantiteRestante: inv.quantiteRestante === '' || 
                         inv.quantiteRestante === null || 
                         inv.quantiteRestante === undefined || 
                         isNaN(Number(inv.quantiteRestante)) 
                         ? 0 
                         : Number(inv.quantiteRestante),
        date: new Date().toISOString().split('T')[0]
      }));

      const response = await fetch('/api/inventaires', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inventaires: inventairesToSave })
      });

      if (response.ok) {
        setLastSavedPage(pageNumber);
        setSavedPages(prev => new Set([...prev, pageNumber]));
        setModifiedSinceLastSave(prev => {
          const newSet = new Set([...prev]);
          newSet.delete(pageNumber);
          return newSet;
        });
        setMessage(`✅ Page ${pageNumber} sauvegardée automatiquement (${pageInventaires.length} produits)`);
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Erreur sauvegarde automatique:', error);
    } finally {
      setAutoSaving(false);
    }
  };

  // Sauvegarde intelligente complète (seulement les pages non sauvegardées ou modifiées)
  const sauvegardeIntelligente = async () => {
    setSaving(true);
    setMessage('🔍 Analyse des pages à sauvegarder...');
    
    const startTime = Date.now();
    
    try {
      // Identifier les pages qui ont besoin d'être sauvegardées
      const pagesToSave: number[] = [];
      
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const isPageSaved = savedPages.has(pageNum);
        const isPageModified = modifiedSinceLastSave.has(pageNum);
        
        if (!isPageSaved || isPageModified) {
          pagesToSave.push(pageNum);
        }
      }
      
      if (pagesToSave.length === 0) {
        setMessage('✅ Tous les produits sont déjà sauvegardés !');
        setTimeout(() => setMessage(''), 3000);
        setSaving(false);
        return;
      }
      
      setMessage(`💾 Sauvegarde intelligente: ${pagesToSave.length} pages sur ${totalPages} à traiter...`);
      
      let totalSaved = 0;
      
      // Sauvegarder seulement les pages nécessaires
      for (const pageNum of pagesToSave) {
        const pageInventaires = getCurrentPageInventaires(pageNum);
        
        const inventairesToSave = pageInventaires.map(inv => ({
          produitId: inv.produitId,
          quantiteRestante: inv.quantiteRestante === '' || 
                           inv.quantiteRestante === null || 
                           inv.quantiteRestante === undefined || 
                           isNaN(Number(inv.quantiteRestante)) 
                           ? 0 
                           : Number(inv.quantiteRestante),
          date: new Date().toISOString().split('T')[0]
        }));

        const response = await fetch('/api/inventaires', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inventaires: inventairesToSave })
        });

        if (response.ok) {
          totalSaved += pageInventaires.length;
          setSavedPages(prev => new Set([...prev, pageNum]));
          setModifiedSinceLastSave(prev => {
            const newSet = new Set([...prev]);
            newSet.delete(pageNum);
            return newSet;
          });
        }
      }
      
      const duration = Date.now() - startTime;
      
      setSaving(false);
      setMessage(`✅ Sauvegarde intelligente terminée !
📊 ${totalSaved} produits sauvegardés sur ${pagesToSave.length} pages en ${duration}ms
💡 ${totalPages - pagesToSave.length} pages étaient déjà à jour`);
      setTimeout(() => setMessage(''), 5000);
      
      // Recharger les données pour synchroniser
      await chargerDonnees();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde intelligente:', error);
      setMessage('❌ Erreur lors de la sauvegarde intelligente');
      setSaving(false);
    }
  };

  // Changer de page avec sauvegarde automatique
  const changePage = async (newPage: number) => {
    if (newPage === currentPage) return;
    
    // Sauvegarder la page courante avant de changer
    const currentPageData = getCurrentPageInventaires();
    await autoSavePage(currentPageData, currentPage);
    
    // Changer de page
    setCurrentPage(newPage);
    setSelectedInput(null);
  };

  // Navigation avec flèche
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      changePage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      changePage(currentPage - 1);
    }
  };

  const handleKeyboardInput = (value: string) => {
    if (!selectedInput) return;
    
    const currentInv = inventaires.find(inv => inv.produitId === selectedInput);
    if (!currentInv) return;

    let newValue = '';
    if (value === 'backspace') {
      const currentValue = currentInv.quantiteRestante.toString();
      newValue = currentValue.slice(0, -1);
    } else if (value === 'clear') {
      newValue = '';
    } else {
      const currentValue = currentInv.quantiteRestante.toString();
      newValue = currentValue + value;
    }
    
    updateQuantite(selectedInput, newValue);
  };

  const selectNextInput = () => {
    if (!selectedInput) return;
    const currentPageInventaires = getCurrentPageInventaires();
    const currentIndex = currentPageInventaires.findIndex(inv => inv.produitId === selectedInput);
    
    if (currentIndex < currentPageInventaires.length - 1) {
      // Produit suivant sur la même page
      const nextInv = currentPageInventaires[currentIndex + 1];
      setSelectedInput(nextInv.produitId);
      
      // Scroll vers l'élément suivant
      const nextElement = document.getElementById(`input-${nextInv.produitId}`);
      if (nextElement) {
        nextElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else if (currentPage < totalPages) {
      // Passer à la page suivante avec sauvegarde
      changePage(currentPage + 1);
      setTimeout(() => {
        const nextPageInventaires = getCurrentPageInventaires(currentPage + 1);
        if (nextPageInventaires.length > 0) {
          setSelectedInput(nextPageInventaires[0].produitId);
          const nextElement = document.getElementById(`input-${nextPageInventaires[0].produitId}`);
          if (nextElement) {
            nextElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 100);
    }
  };

  // Calculer les données de pagination
  const totalPages = Math.ceil(inventaires.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  // Fonction pour obtenir les inventaires de la page courante
  const getCurrentPageInventaires = (page = currentPage) => {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return inventaires.slice(start, end);
  };

  const currentPageInventaires = getCurrentPageInventaires();

  // Statistiques pour la page courante
  const currentPageStats = {
    total: currentPageInventaires.length,
    withStock: currentPageInventaires.filter(inv => inv.quantiteRestante && inv.quantiteRestante !== '' && inv.quantiteRestante !== 0).length,
    empty: currentPageInventaires.filter(inv => !inv.quantiteRestante || inv.quantiteRestante === '' || inv.quantiteRestante === 0).length
  };

  const getProduitNom = (produitId: string) => {
    const produit = produits.find(p => p.id === produitId);
    return produit ? produit.nom : 'Produit inconnu';
  };

  const sauvegarder = async () => {
    setSaving(true);
    setMessage('💾 Sauvegarde en cours...');
    
    const startTime = Date.now();
    
    try {
      // Préparer tous les inventaires en une seule fois
      const inventairesToSave = inventaires.map(inv => ({
        produitId: inv.produitId,
        quantiteRestante: inv.quantiteRestante === '' || 
                         inv.quantiteRestante === null || 
                         inv.quantiteRestante === undefined || 
                         isNaN(Number(inv.quantiteRestante)) 
                         ? 0 
                         : Number(inv.quantiteRestante),
        date: new Date().toISOString().split('T')[0]
      }));

      console.log('📊 Sauvegarde de', inventairesToSave.length, 'inventaires...');
      
      // Une seule requête pour tous les inventaires
      const response = await fetch('/api/inventaires', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inventaires: inventairesToSave })
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();
      const duration = Date.now() - startTime;
      
      console.log('✅ Sauvegarde terminée:', result);
      
      setSaving(false);
      
      setMessage(`✅ Inventaire sauvegardé avec succès !
📊 ${result.success} produits traités en ${duration}ms
${result.performance ? `⚡ ${result.performance.recordsPerSecond} produits par seconde` : ''}`);
      setTimeout(() => setMessage(''), 5000);
      
      // Recharger les données pour afficher les nouvelles valeurs
      await chargerDonnees();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setMessage('❌ Erreur lors de la sauvegarde');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-32">
      {/* Navigation fixe */}
      <div className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-full mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-900">💼 Inventaire</h1>
              <div className="text-xs text-gray-600">
                <span className="font-semibold text-blue-600">Page {currentPage}/{totalPages}</span> • 
                <span className="ml-1 font-semibold text-purple-600">{currentPageStats.total}</span> produits • 
                <span className="ml-1 font-semibold text-green-600">{currentPageStats.withStock}</span> OK • 
                <span className="ml-1 font-semibold text-red-600">{currentPageStats.empty}</span> vides
                {savedPages.has(currentPage) && !modifiedSinceLastSave.has(currentPage) && (
                  <span className="ml-2 text-green-600">✓ Sauvegardé</span>
                )}
                {modifiedSinceLastSave.has(currentPage) && (
                  <span className="ml-2 text-orange-600">⚠ Modifié</span>
                )}
                {autoSaving && (
                  <span className="ml-2 text-blue-600">💾 Sauvegarde...</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Bouton flèche navigation manuelle */}
              <div className="flex items-center gap-1">
                <button
                  onClick={goToPrevPage}
                  disabled={currentPage === 1 || autoSaving}
                  className="px-3 py-2 rounded text-sm font-bold bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors shadow-sm"
                  title="Page précédente"
                >
                  ← 
                </button>
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages || autoSaving}
                  className="px-3 py-2 rounded text-sm font-bold bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors shadow-sm"
                  title="Page suivante"
                >
                  →
                </button>
              </div>
              <button
                onClick={() => setShowKeyboard(!showKeyboard)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  showKeyboard 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🔢 Clavier
              </button>
              <Link 
                href="/" 
                className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-1.5 px-3 rounded transition-colors text-sm"
              >
                ← Retour
              </Link>
            </div>
          </div>

          {/* Navigation des pages avec sauvegarde automatique */}
          <div className="flex justify-center items-center gap-2 mt-3 border-t pt-3">
            <button
              onClick={() => changePage(1)}
              disabled={currentPage === 1 || autoSaving}
              className="px-3 py-1 rounded text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
            >
              ⏮ Début
            </button>
            <button
              onClick={goToPrevPage}
              disabled={currentPage === 1 || autoSaving}
              className="px-3 py-1 rounded text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
            >
              ← Précédent
            </button>
            
            {/* Affichage des numéros de pages */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => changePage(pageNum)}
                    disabled={autoSaving}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {pageNum}
                    {savedPages.has(pageNum) && !modifiedSinceLastSave.has(pageNum) && (
                      <span className="ml-1 text-green-500">✓</span>
                    )}
                    {modifiedSinceLastSave.has(pageNum) && (
                      <span className="ml-1 text-orange-500">⚠</span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages || autoSaving}
              className="px-3 py-1 rounded text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
            >
              Suivant →
            </button>
            <button
              onClick={() => changePage(totalPages)}
              disabled={currentPage === totalPages || autoSaving}
              className="px-3 py-1 rounded text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
            >
              Fin ⏭
            </button>
          </div>
        </div>
      </div>

      {/* Message de statut */}
      {message && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className={`p-4 rounded-lg text-center font-medium ${
            message.includes('✅') 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : message.includes('❌')
              ? 'bg-red-100 text-red-800 border border-red-200'
              : 'bg-blue-100 text-blue-800 border border-blue-200'
          }`}>
            <pre className="whitespace-pre-wrap text-sm">{message}</pre>
          </div>
        </div>
      )}

      {/* Contenu principal */}
      <div className="max-w-full mx-auto px-2 py-3">
        {/* En-tête */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-4">
          <div className="bg-blue-600 text-white p-3">
            <h2 className="text-lg font-bold text-center">📋 INVENTAIRE FIN DE JOURNÉE</h2>
            <p className="text-center text-blue-100 mt-1 text-sm">
              {new Date().toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
        </div>

        {/* Grille optimisée pour lisibilité - Page courante */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
          {currentPageInventaires.map((inv, index) => {
            const globalIndex = startIndex + index;
            return (
              <div 
                key={inv.produitId}
                className={`rounded-lg shadow-sm border p-2 transition-colors hover:shadow-md ${
                  globalIndex % 2 === 0 
                    ? 'bg-white border-gray-200' 
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                {/* Layout horizontal amélioré : #1 Nom Produit [QTÉ] */}
                <div className="flex items-center gap-2">
                  {/* Numéro avec couleur alternée */}
                  <span className={`text-xs font-bold px-2 py-1 rounded flex-shrink-0 ${
                    globalIndex % 2 === 0 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    #{globalIndex + 1}
                  </span>

                  {/* Nom du produit - Plus lisible */}
                  <span className="text-sm font-medium text-black flex-1 leading-tight">
                    {getProduitNom(inv.produitId)}
                  </span>

                  {/* Champ de saisie mis en évidence */}
                  <div className="flex-shrink-0">
                    <input
                      id={`input-${inv.produitId}`}
                      type="number"
                      min="0"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={inv.quantiteRestante}
                      onChange={(e) => updateQuantite(inv.produitId, e.target.value)}
                      onFocus={() => {
                        setSelectedInput(inv.produitId);
                        setShowKeyboard(true);
                      }}
                      className={`w-16 p-2 text-center rounded-md text-sm font-bold text-black transition-all ${
                        selectedInput === inv.produitId
                          ? 'border-2 border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-2 border-yellow-300 bg-yellow-50 hover:bg-white'
                      } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white`}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Statistiques globales avec état des sauvegardes */}
        <div className="bg-white rounded-lg shadow-lg p-3 mb-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="text-xs text-gray-600">
              <span className="font-semibold text-purple-600">Total: {inventaires.length}</span> produits • 
              <span className="ml-1 font-semibold text-green-600">
                {inventaires.filter(inv => inv.quantiteRestante && inv.quantiteRestante !== '' && inv.quantiteRestante !== 0).length}
              </span> avec stock • 
              <span className="ml-1 font-semibold text-red-600">
                {inventaires.filter(inv => !inv.quantiteRestante || inv.quantiteRestante === '' || inv.quantiteRestante === 0).length}
              </span> en rupture
            </div>
            <div className="text-xs text-gray-600">
              <span className="font-semibold text-green-600">{savedPages.size}</span> pages sauvegardées • 
              <span className="ml-1 font-semibold text-orange-600">{modifiedSinceLastSave.size}</span> pages modifiées
            </div>
          </div>
        </div>

        {/* Navigation de page en bas avec sauvegarde */}
        <div className="bg-white rounded-lg shadow-lg p-3 mb-4">
          <div className="flex justify-center items-center gap-2">
            <button
              onClick={goToPrevPage}
              disabled={currentPage === 1 || autoSaving}
              className="px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-1 transition-colors shadow-sm"
            >
              ← Page précédente
              {autoSaving && <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></div>}
            </button>
            <span className="px-4 py-2 text-sm font-medium text-gray-600">
              Page {currentPage} / {totalPages}
              {savedPages.has(currentPage) && !modifiedSinceLastSave.has(currentPage) && (
                <span className="ml-2 text-green-600">✓ Sauvegardé</span>
              )}
              {modifiedSinceLastSave.has(currentPage) && (
                <span className="ml-2 text-orange-600">⚠ Modifié</span>
              )}
            </span>
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages || autoSaving}
              className="px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-1 transition-colors shadow-sm"
            >
              Page suivante →
              {autoSaving && <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></div>}
            </button>
          </div>
        </div>

        {/* Bouton de sauvegarde intelligente */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
          <div className="flex justify-center">
            <button
              onClick={sauvegardeIntelligente}
              disabled={saving || autoSaving}
              className={`w-full sm:w-auto font-bold py-3 px-6 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed text-base shadow-lg ${
                modifiedSinceLastSave.size > 0 || savedPages.size < totalPages
                  ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white'
                  : 'bg-gray-300 text-gray-600 cursor-not-allowed'
              }`}
            >
              {saving ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Sauvegarde intelligente...
                </div>
              ) : modifiedSinceLastSave.size > 0 || savedPages.size < totalPages ? (
                `🧠 SAUVEGARDE INTELLIGENTE (${Math.max(modifiedSinceLastSave.size, totalPages - savedPages.size)} pages à traiter)`
              ) : (
                '✅ TOUT EST SAUVEGARDÉ'
              )}
            </button>
          </div>
          <p className="text-xs text-gray-600 text-center mt-2">
            * Sauvegarde uniquement les pages modifiées ou non sauvegardées • Optimisation automatique
          </p>
        </div>

        {/* Clavier virtuel fixe en bas */}
        {showKeyboard && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-50 p-4">
            <div className="max-w-md mx-auto">
              {/* Affichage du produit sélectionné */}
              {selectedInput && (
                <div className="bg-blue-50 rounded-lg p-3 mb-4 text-center">
                  <div className="text-sm font-medium text-blue-800">
                    {getProduitNom(selectedInput)}
                  </div>
                  <div className="text-2xl font-bold text-blue-900 mt-1">
                    {inventaires.find(inv => inv.produitId === selectedInput)?.quantiteRestante || '0'}
                  </div>
                </div>
              )}
              
              {/* Grille du clavier */}
              <div className="grid grid-cols-4 gap-2">
                {/* Chiffres */}
                {[1, 2, 3, 'clear'].map((key) => (
                  <button
                    key={key}
                    onClick={() => handleKeyboardInput(key.toString())}
                    className={`h-12 rounded-lg font-bold text-lg transition-colors ${
                      key === 'clear' 
                        ? 'bg-red-100 hover:bg-red-200 text-red-800 text-sm' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                    }`}
                  >
                    {key === 'clear' ? 'CLR' : key}
                  </button>
                ))}
                
                {[4, 5, 6, 'backspace'].map((key) => (
                  <button
                    key={key}
                    onClick={() => handleKeyboardInput(key.toString())}
                    className={`h-12 rounded-lg font-bold text-lg transition-colors ${
                      key === 'backspace' 
                        ? 'bg-orange-100 hover:bg-orange-200 text-orange-800 text-sm' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                    }`}
                  >
                    {key === 'backspace' ? '⌫' : key}
                  </button>
                ))}
                
                {[7, 8, 9, 'next'].map((key) => (
                  <button
                    key={key}
                    onClick={() => key === 'next' ? selectNextInput() : handleKeyboardInput(key.toString())}
                    className={`h-12 rounded-lg font-bold text-lg transition-colors ${
                      key === 'next' 
                        ? 'bg-green-100 hover:bg-green-200 text-green-800 text-sm' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                    }`}
                  >
                    {key === 'next' ? 'SUIV' : key}
                  </button>
                ))}
                
                {['0', '00', 'hide'].map((key) => (
                  <button
                    key={key}
                    onClick={() => key === 'hide' ? setShowKeyboard(false) : handleKeyboardInput(key)}
                    className={`h-12 rounded-lg font-bold text-lg transition-colors ${
                      key === 'hide' 
                        ? 'bg-gray-600 hover:bg-gray-700 text-white text-sm col-span-2' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                    }`}
                  >
                    {key === 'hide' ? 'FERMER CLAVIER' : key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}