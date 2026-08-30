'use client';

import { useState, useEffect } from 'react';
import { LIBELLE_POSTE, ORDRE_CATEGORIES, POSTES, type Poste } from '@/lib/postes';

interface Produit {
  id: number;
  nom: string;
  ordre: number;
  categorie: string;
  poste: string;
  actif: boolean;
}

export default function GestionProduits() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [noms, setNoms] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  
  // États pour modification/suppression
  const [modeModification, setModeModification] = useState<number | null>(null);
  const [nouveauNom, setNouveauNom] = useState('');
  const [nouvelOrdre, setNouvelOrdre] = useState('');
  const [codeSecurite, setCodeSecurite] = useState('');
  // Sans ces deux champs, tout nouveau produit tombait en « Autres » /
  // « boulanger » et n'apparaissait sur aucun écran attendu.
  const [nouvelleCategorie, setNouvelleCategorie] = useState('Viennoiserie');
  const [nouveauPoste, setNouveauPoste] = useState('patissier');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [produitASupprimer, setProduitASupprimer] = useState<{id: number, nom: string, inventairesCount?: number} | null>(null);

  // États pour réorganisation
  const [modeReorganisation, setModeReorganisation] = useState(false);
  const [produitsReorganises, setProduitsReorganises] = useState<Produit[]>([]);
  const [ordreSelectionne, setOrdreSelectionne] = useState<number[]>([]);
  const [savingOrdre, setSavingOrdre] = useState(false);

  // Charger les produits au démarrage
  useEffect(() => {
    loadProduits();
  }, []);

  const loadProduits = async () => {
    try {
      // Sans inclureInactifs, un produit désactivé disparaît de cet écran :
      // il ne pourrait plus jamais être réactivé.
      const response = await fetch('/api/produits?inclureInactifs=1');
      const data = await response.json();
      setProduits(data);
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch('/api/produits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          noms,
          codeSecurite,
          categorie: nouvelleCategorie || undefined,
          poste: nouveauPoste || undefined,
        }),
      });
      
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
      
      if (response.ok) {
        setNoms('');
        await loadProduits();
      }
    } catch (error) {
      setResult('Erreur: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const startModification = (produit: Produit) => {
    setModeModification(produit.id);
    setNouveauNom(produit.nom);
    setNouvelOrdre(produit.ordre.toString());
    setShowCodeInput(true);
  };

  const cancelModification = () => {
    setModeModification(null);
    setNouveauNom('');
    setNouvelOrdre('');
    setCodeSecurite('');
    setShowCodeInput(false);
  };

  const handleModification = async (id: number) => {
    if (!codeSecurite) {
      setResult('Code de sécurité requis pour modifier');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/produits', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id, 
          nouveauNom, 
          nouvelOrdre: nouvelOrdre ? parseInt(nouvelOrdre) : undefined,
          codeSecurite 
        }),
      });
      
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
      
      if (response.ok) {
        await loadProduits();
        cancelModification();
      }
    } catch (error) {
      setResult('Erreur: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuppression = async (id: number, nom: string, forceSuppression = false) => {
    if (!codeSecurite) {
      setResult('Code de sécurité requis pour supprimer. Entrez le code de gestion dans le champ ci-dessous.');
      setShowCodeInput(true);
      return;
    }

    if (!forceSuppression && !confirm(`Êtes-vous sûr de vouloir supprimer "${nom}" ? Cette action est irréversible.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/produits', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id, 
          codeSecurite,
          forceSuppression 
        }),
      });
      
      const data = await response.json();
      
      // Un produit qui a de l'historique n'est pas supprimé : il est
      // désactivé, et le serveur répond 200. La suppression définitive reste
      // possible, mais elle emporte l'historique — d'où la confirmation.
      if (response.ok && data.desactive) {
        setProduitASupprimer({ id, nom, inventairesCount: data.historique });
        setResult(data.message);
        await loadProduits();
        return;
      }

      setResult(data.message ?? data.error ?? 'Terminé.');
      
      if (response.ok) {
        await loadProduits();
        setCodeSecurite('');
        setShowCodeInput(false);
        setProduitASupprimer(null);
      }
    } catch (error) {
      setResult('Erreur: ' + error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Un produit retiré est désactivé, pas effacé : sans ce bouton il
   * disparaissait des écrans de saisie sans aucun moyen de revenir en arrière.
   */
  const handleReactivation = async (id: number, nom: string) => {
    if (!codeSecurite.trim()) {
      setResult('Entrez le code de gestion pour réactiver un produit.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/produits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, actif: true, codeSecurite }),
      });
      const data = await response.json();
      setResult(response.ok ? `« ${nom} » est de nouveau dans les listes de saisie.` : (data.error ?? 'Échec'));
      if (response.ok) await loadProduits();
    } catch (error) {
      setResult('Erreur: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuppressionForcee = async () => {
    if (!produitASupprimer) return;
    
    if (!confirm(`⚠️ SUPPRESSION FORCÉE ⚠️\n\nVoulez-vous vraiment supprimer "${produitASupprimer.nom}" ET tous ses ${produitASupprimer.inventairesCount} inventaire(s) ?\n\nCette action est IRRÉVERSIBLE et supprimera définitivement :\n- Le produit\n- Tous ses inventaires historiques\n\nTapez OK pour confirmer.`)) {
      return;
    }

    await handleSuppression(produitASupprimer.id, produitASupprimer.nom, true);
  };

  // Fonctions pour la réorganisation
  const startReorganisation = () => {
    setModeReorganisation(true);
    setProduitsReorganises([...produits]);
    setOrdreSelectionne([]);
    setResult('');
  };

  const cancelReorganisation = () => {
    setModeReorganisation(false);
    setProduitsReorganises([]);
    setOrdreSelectionne([]);
  };

  const ajouterProduitAOrdre = (produit: Produit) => {
    if (ordreSelectionne.includes(produit.id)) {
      // Retirer de l'ordre si déjà sélectionné
      setOrdreSelectionne(prev => prev.filter(id => id !== produit.id));
    } else {
      // Ajouter à la fin de l'ordre
      setOrdreSelectionne(prev => [...prev, produit.id]);
    }
  };

  const retirerDeLordre = (produitId: number) => {
    setOrdreSelectionne(prev => prev.filter(id => id !== produitId));
  };

  const monterProduit = (index: number) => {
    if (index > 0) {
      const newOrdre = [...ordreSelectionne];
      [newOrdre[index], newOrdre[index - 1]] = [newOrdre[index - 1], newOrdre[index]];
      setOrdreSelectionne(newOrdre);
    }
  };

  const descendreProduit = (index: number) => {
    if (index < ordreSelectionne.length - 1) {
      const newOrdre = [...ordreSelectionne];
      [newOrdre[index], newOrdre[index + 1]] = [newOrdre[index + 1], newOrdre[index]];
      setOrdreSelectionne(newOrdre);
    }
  };

  const sauvegarderNouvelOrdre = async () => {
    if (!codeSecurite) {
      setResult('Code de sécurité requis pour réorganiser');
      return;
    }

    if (ordreSelectionne.length === 0) {
      setResult('Sélectionnez au moins un produit dans l\'ordre souhaité');
      return;
    }

    setSavingOrdre(true);
    setResult('Sauvegarde optimisée en cours...');

    try {
      const startTime = Date.now();
      
      // Utiliser la nouvelle API optimisée pour la réorganisation en masse
      const response = await fetch('/api/produits/reorganiser', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          ordreNouveau: ordreSelectionne,
          codeSecurite 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la mise à jour');
      }

      const result = await response.json();
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      setResult(`✅ Réorganisation optimisée terminée !
      📊 ${result.success} produit(s) réorganisé(s)
      ⚡ Temps total: ${totalDuration}ms (API: ${result.performance.duration})
      🚀 Performance: ${result.performance.recordsPerSecond} produits/seconde`);
      
      await loadProduits();
      cancelReorganisation();
      setCodeSecurite('');
      
    } catch (error) {
      setResult('Erreur:' + error);
    } finally {
      setSavingOrdre(false);
    }
  };

  const getProduitById = (id: number) => {
    return produits.find(p => p.id === id);
  };

  return (
    <div className="min-h-screen bg-surface-2 py-4 px-4 sm:py-8 sm:px-6 lg:px-8">
      <div>
{/* Header avec navigation */}
        <div className="mb-6 sm:mb-8">
          <a 
            href="/" 
            className="inline-flex items-center text-accent hover:text-accent mb-4 text-sm sm:text-base"
          >
            Retour à l'accueil
          </a>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink">Gestion des Produits</h1>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Formulaire d'ajout - Mobile responsive */}
          <div className="bg-surface rounded-xl shadow-sm border border-line p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-ink mb-4">Ajouter des produits</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-black mb-2">
                  Noms des produits (séparés par des virgules)
                </label>
                <textarea
                  value={noms}
                  onChange={(e) => setNoms(e.target.value)}
                  placeholder="Croissant, Pain de campagne, Tarte aux pommes..."
                  className="w-full p-3 border border-line rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base text-black"
                  rows={4}
                  required
                />
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-ink" htmlFor="rayon-nouveau">
                    Rayon
                  </label>
                  <select
                    id="rayon-nouveau"
                    value={nouvelleCategorie}
                    onChange={(e) => setNouvelleCategorie(e.target.value)}
                    className="h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink"
                  >
                    {ORDRE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-ink" htmlFor="poste-nouveau">
                    Fabriqué par
                  </label>
                  <select
                    id="poste-nouveau"
                    value={nouveauPoste}
                    onChange={(e) => setNouveauPoste(e.target.value)}
                    className="h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink"
                  >
                    {POSTES.map((p) => (
                      <option key={p} value={p}>
                        {LIBELLE_POSTE[p as Poste]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-ink" htmlFor="code-ajout">
                  Code de gestion
                </label>
                <input
                  id="code-ajout"
                  type="password"
                  value={codeSecurite}
                  onChange={(e) => setCodeSecurite(e.target.value)}
                  placeholder="Code de gestion"
                  className="h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-white p-3 rounded-md hover:bg-accent-fort disabled:bg-gray-400 font-medium text-base transition-colors"
              >
                {loading ? 'Ajout en cours...' : 'Ajouter les produits'}
              </button>
            </form>
            
            {result && (
              <div className="mt-4">
                <h3 className="font-medium text-black mb-2">Résultat:</h3>
                <pre className="bg-surface-2 border border-line p-3 rounded text-xs sm:text-sm overflow-auto max-h-40">
                  {result}
                </pre>
              </div>
            )}
          </div>

          {/* Liste des produits - Mobile responsive */}
          <div className="bg-surface rounded-xl shadow-sm border border-line p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-ink mb-2 sm:mb-0">Produits existants</h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={startReorganisation}
                  disabled={modeReorganisation}
                  className="w-full sm:w-auto bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 font-medium text-sm transition-colors disabled:bg-gray-400"
                >
                  Réorganiser l'ordre
                </button>
                <button
                  onClick={loadProduits}
                  className="w-full sm:w-auto bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium text-sm transition-colors"
                >
                  Actualiser
                </button>
              </div>
            </div>

            {/* Explication de l'ordre */}
            <div className="bg-accent-doux border border-accent rounded-xl p-4 mb-4">
              <h3 className="font-semibold text-accent mb-2">Ordre d'affichage</h3>
              <p className="text-sm text-accent mb-2">
                L'ordre détermine la position des produits dans toutes les listes. 
                <strong> Plus le chiffre est petit, plus le produit apparaît en premier.</strong>
              </p>
              <div className="text-xs text-accent mb-3">
                Exemple : Ordre 1 = Pain (en premier), Ordre 2 = Croissants, Ordre 3 = Pâtisseries
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-medium text-accent">Suggestions rapides :</span>
                <button
                  onClick={() => { /* TODO: Auto-numéroter */ }}
                  className="text-xs bg-accent-doux hover:bg-blue-200 text-accent px-2 py-1 rounded"
                >
                  Auto-numéroter 1,2,3...
                </button>
                <button
                  onClick={() => { /* TODO: Grouper par type */ }}
                  className="text-xs bg-accent-doux hover:bg-blue-200 text-accent px-2 py-1 rounded"
                >
                  Grouper par type
                </button>
              </div>
            </div>

            {/* Interface de réorganisation */}
            {modeReorganisation && (
              <div className="bg-accent-doux border border-purple-200 rounded-xl p-4 mb-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
                  <h3 className="font-semibold text-accent mb-2 sm:mb-0">Mode Réorganisation</h3>
                  <button
                    onClick={cancelReorganisation}
                    className="text-sm bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded"
                  >
                    Annuler
                  </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Liste des produits disponibles */}
                  <div>
                    <h4 className="font-medium text-black mb-2">Produits disponibles</h4>
                    <p className="text-sm text-black mb-3">Cliquez pour ajouter à votre ordre :</p>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {produits.map((produit) => (
                        <button
                          key={produit.id}
                          onClick={() => ajouterProduitAOrdre(produit)}
                          className={`w-full text-left p-3 rounded-xl border transition-colors ${
                            ordreSelectionne.includes(produit.id)
                              ? 'bg-ok-doux border-green-300 text-ok'
                              : 'bg-surface border-line hover:bg-surface-2'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-black">{produit.nom}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-surface-2 px-2 py-1 rounded">#{produit.id}</span>
                              {ordreSelectionne.includes(produit.id) && (
                                <span className="text-ok"></span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ordre sélectionné */}
                  <div>
                    <h4 className="font-medium text-black mb-2">Ordre pour les vendeurs</h4>
                    <p className="text-sm text-black mb-3">Ordre d'affichage (utilisez pour ajuster) :</p>
                    
                    {ordreSelectionne.length === 0 ? (
                      <div className="bg-surface-2 border border-line rounded-xl p-4 text-center text-black">
                        Aucun produit sélectionné
                      </div>
                    ) : (
                      <>
                        <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                          {ordreSelectionne.map((produitId, index) => {
                            const produit = getProduitById(produitId);
                            if (!produit) return null;
                            
                            return (
                              <div key={produitId} className="bg-surface border border-line rounded-xl p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <span className="bg-accent-doux text-accent text-sm font-bold px-2 py-1 rounded">
                                      {index + 1}
                                    </span>
                                    <span className="font-medium text-black">{produit.nom}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => monterProduit(index)}
                                      disabled={index === 0}
                                      className="p-1 text-accent hover:bg-accent-doux rounded disabled:text-ink-3"
                                    >
                                      
                                    </button>
                                    <button
                                      onClick={() => descendreProduit(index)}
                                      disabled={index === ordreSelectionne.length - 1}
                                      className="p-1 text-accent hover:bg-accent-doux rounded disabled:text-ink-3"
                                    >
                                      
                                    </button>
                                    <button
                                      onClick={() => retirerDeLordre(produitId)}
                                      className="p-1 text-alerte hover:bg-alerte-doux rounded ml-1"
                                    >
                                      
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Code de sécurité et sauvegarde */}
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-accent mb-1">Code de sécurité</label>
                            <input
                              type="password"
                              value={codeSecurite}
                              onChange={(e) => setCodeSecurite(e.target.value)}
                              className="w-full p-2 border border-line rounded-md focus:ring-2 focus:ring-purple-500 text-black"
                              placeholder="Code de gestion"
                            />
                          </div>
                          <button
                            onClick={sauvegarderNouvelOrdre}
                            disabled={savingOrdre || !codeSecurite}
                            className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:bg-gray-400 font-medium transition-colors"
                          >
                            {savingOrdre ? 'Sauvegarde...' : `💾 Sauvegarder l'ordre (${ordreSelectionne.length} produits)`}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {produits.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3"></div>
                <p className="text-black text-base">Aucun produit trouvé</p>
                <p className="text-black text-sm mt-1">Ajoutez vos premiers produits ci-dessus</p>
              </div>
            ) : (
              <>
                {/* Version Mobile : Cards */}
                <div className="block sm:hidden space-y-3">
                  {produits.map((produit) => (
                    <div key={produit.id} className="bg-surface-2 border border-line p-4 rounded-xl">
                      {modeModification === produit.id ? (
                        // Mode modification
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-black mb-1">Nom du produit</label>
                            <input
                              type="text"
                              value={nouveauNom}
                              onChange={(e) => setNouveauNom(e.target.value)}
                              className="w-full p-2 border border-line rounded-md focus:ring-2 focus:ring-blue-500 text-black"
                              placeholder="Nouveau nom"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-black mb-1">Ordre d'affichage</label>
                            <input
                              type="number"
                              min="0"
                              value={nouvelOrdre}
                              onChange={(e) => setNouvelOrdre(e.target.value)}
                              className="w-full p-2 border border-line rounded-md focus:ring-2 focus:ring-blue-500 text-black"
                              placeholder="Position (1=premier, 2=deuxième...)"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-black mb-1">Code de sécurité</label>
                            <input
                              type="password"
                              value={codeSecurite}
                              onChange={(e) => setCodeSecurite(e.target.value)}
                              className="w-full p-2 border border-line rounded-md focus:ring-2 focus:ring-blue-500 text-black"
                              placeholder="Code de gestion"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleModification(produit.id)}
                              disabled={loading}
                              className="flex-1 bg-green-600 text-white py-2 px-3 rounded text-sm hover:bg-green-700 disabled:bg-gray-400"
                            >
                              Confirmer
                            </button>
                            <button
                              onClick={cancelModification}
                              className="flex-1 bg-gray-500 text-white py-2 px-3 rounded text-sm hover:bg-gray-600"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Mode normal
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-ink-3">#{produit.id}</span>
                                <span className="rounded-full bg-accent-doux px-2 py-1 text-xs font-medium text-accent">
                                  {produit.categorie}
                                </span>
                                <span className="rounded-full border border-line px-2 py-1 text-xs text-ink-2">
                                  {LIBELLE_POSTE[produit.poste as Poste] ?? produit.poste}
                                </span>
                                {!produit.actif ? (
                                  <span className="rounded-full bg-attention-doux px-2 py-1 text-xs font-medium text-attention">
                                    retiré des saisies
                                  </span>
                                ) : null}
                              </div>
                              <h3 className={`mt-1 text-base font-medium ${produit.actif ? 'text-ink' : 'text-ink-3 line-through'}`}>
                                {produit.nom}
                              </h3>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startModification(produit)}
                              className="flex-1 rounded bg-accent px-3 py-2 text-sm text-white hover:bg-accent-fort"
                            >
                              Modifier
                            </button>
                            {produit.actif ? (
                              <button
                                onClick={() => handleSuppression(produit.id, produit.nom)}
                                className="flex-1 rounded border border-alerte/40 bg-alerte-doux px-3 py-2 text-sm text-alerte hover:border-alerte"
                              >
                                Retirer
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivation(produit.id, produit.nom)}
                                className="flex-1 rounded border border-ok/40 bg-ok-doux px-3 py-2 text-sm text-ok hover:border-ok"
                              >
                                Réactiver
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Version Desktop : Liste */}
                <div className="hidden sm:block space-y-2 max-h-96 overflow-y-auto">
                  {produits.map((produit) => (
                    <div key={produit.id} className="bg-surface-2 border border-line p-4 rounded-xl">
                      {modeModification === produit.id ? (
                        // Mode modification desktop
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-black font-mono w-12">#{produit.id}</span>
                          <input
                            type="text"
                            value={nouveauNom}
                            onChange={(e) => setNouveauNom(e.target.value)}
                            className="flex-1 p-2 border border-line rounded-md focus:ring-2 focus:ring-blue-500 text-black"
                            placeholder="Nom du produit"
                            title="Nom du produit"
                          />
                          <input
                            type="number"
                            min="0"
                            value={nouvelOrdre}
                            onChange={(e) => setNouvelOrdre(e.target.value)}
                            className="w-20 p-2 border border-line rounded-md focus:ring-2 focus:ring-blue-500 text-black"
                            placeholder="Ordre"
                            title="Ordre d'affichage"
                          />
                          <input
                            type="password"
                            value={codeSecurite}
                            onChange={(e) => setCodeSecurite(e.target.value)}
                            className="w-24 p-2 border border-line rounded-md focus:ring-2 focus:ring-blue-500 text-black"
                            placeholder="Code de gestion"
                            title="Code de sécurité"
                          />
                          <button
                            onClick={() => handleModification(produit.id)}
                            disabled={loading}
                            className="bg-green-600 text-white py-2 px-3 rounded text-sm hover:bg-green-700 disabled:bg-gray-400"
                          >
                            
                          </button>
                          <button
                            onClick={cancelModification}
                            className="bg-gray-500 text-white py-2 px-3 rounded text-sm hover:bg-gray-600"
                          >
                            
                          </button>
                        </div>
                      ) : (
                        // Mode normal desktop
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-ink-3 font-mono">#{produit.id}</span>
                            <span className="bg-accent-doux text-accent text-xs px-2 py-1 rounded-full font-medium">
                              {produit.ordre}
                            </span>
                            <span className="font-medium text-ink">{produit.nom}</span>
                            <div className="text-accent"></div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startModification(produit)}
                              className="bg-accent text-white py-1 px-3 rounded text-sm hover:bg-accent-fort"
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => handleSuppression(produit.id, produit.nom)}
                              className="bg-red-600 text-white py-1 px-3 rounded text-sm hover:bg-red-700"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Compteur de produits */}
            {produits.length > 0 && (
              <div className="mt-4 pt-4 border-t border-line">
                <p className="text-sm text-ink-2 text-center">
                  <span className="font-medium">{produits.length}</span> produit{produits.length > 1 ? 's' : ''} enregistré{produits.length > 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Alerte de suppression forcée */}
        {produitASupprimer && (
          <div className="mt-6 bg-alerte-doux border border-red-200 rounded-xl p-4">
            <h3 className="font-medium text-red-900 mb-2">Produit avec inventaires détecté</h3>
            <div className="bg-surface border border-red-200 rounded p-3 mb-4">
              <p className="text-alerte text-sm">
                <strong>Produit :</strong> {produitASupprimer.nom}<br/>
                <strong>Inventaires associés :</strong> {produitASupprimer.inventairesCount}<br/>
                <strong>Problème :</strong> Ce produit ne peut pas être supprimé car il a des inventaires.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSuppressionForcee}
                disabled={loading}
                className="bg-red-600 text-white px-4 py-3 rounded-md hover:bg-red-700 disabled:bg-gray-400 font-medium text-base"
              >
                Suppression forcée (produit + inventaires)
              </button>
              <button
                onClick={() => setProduitASupprimer(null)}
                className="bg-gray-500 text-white px-4 py-3 rounded-md hover:bg-gray-600 font-medium text-base"
              >
                Annuler
              </button>
            </div>
            <p className="text-alerte text-sm mt-3">
              <strong>Attention :</strong> La suppression forcée supprimera définitivement le produit ET tous ses inventaires historiques.
            </p>
          </div>
        )}

        {/* Code de sécurité pour modification/suppression */}
        <div className="mt-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <h3 className="font-medium text-orange-900 mb-2">Code de sécurité</h3>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-orange-700 mb-1">
                Code de gestion (requis pour modifier ou supprimer)
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={codeSecurite}
                  onChange={(e) => setCodeSecurite(e.target.value)}
                  className={`w-full p-3 border rounded-md focus:ring-2 focus:border-orange-500 text-black ${
                    codeSecurite.trim().length > 0 
                      ? 'border-green-300 bg-ok-doux focus:ring-green-500' 
                      : 'border-orange-300 focus:ring-orange-500'
                  }`}
                  placeholder="Entrez le code de gestion"
                />
                {codeSecurite.trim().length > 0 && (
                  <div className="absolute right-3 top-3 text-ok"></div>
                )}
              </div>
            </div>
            <button
              onClick={() => setCodeSecurite('')}
              className="w-full sm:w-auto bg-gray-500 text-white px-4 py-3 rounded-md hover:bg-gray-600 font-medium text-base"
            >
              Effacer
            </button>
          </div>
          <p className="text-orange-700 text-sm mt-2">
            <strong>Tip:</strong> Entrez d'abord le code, puis cliquez sur "Modifier" ou "Supprimer"
            {codeSecurite.trim().length > 0 && (
              <span className="text-ok font-medium"> Code correct !</span>
            )}
          </p>
        </div>

        {/* Instructions et conseils */}
        <div className="mt-6 sm:mt-8 bg-accent-doux border border-accent rounded-xl p-4">
          <h3 className="font-medium text-blue-900 mb-2 text-base">Guide d'utilisation :</h3>
          <ul className="text-accent text-sm space-y-1">
            <li>• <strong>Ajouter</strong> : Séparez les noms de produits par des virgules</li>
            <li>• <strong>Modifier</strong> : 
              <ol className="ml-4 mt-1 space-y-1">
                <li>1. Entrez le code de gestion dans le champ orange</li>
                <li>2. Cliquez sur "Modifier" sur le produit</li>
                <li>3. Modifiez le nom et confirmez</li>
              </ol>
            </li>
            <li>• <strong>Supprimer</strong> : 
              <ol className="ml-4 mt-1 space-y-1">
                <li>1. Entrez le code de gestion dans le champ orange</li>
                <li>2. Cliquez sur "Supprimer" sur le produit</li>
                <li>3. Confirmez la suppression</li>
              </ol>
            </li>
            <li>• <strong>Attention</strong> : Impossible de supprimer un produit avec des inventaires existants</li>
            <li>• Les doublons sont automatiquement ignorés lors de l'ajout</li>
          </ul>
        </div>

        {/* Navigation rapide */}
        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <a
            href="/inventaire"
            className="inline-flex items-center justify-center bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 font-medium text-base transition-colors"
          >
            Aller à la saisie d'inventaire
          </a>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center bg-accent text-white px-6 py-3 rounded-md hover:bg-accent-fort font-medium text-base transition-colors"
          >
            Voir le dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
