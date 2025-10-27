'use client';

import { useState, useEffect } from 'react';

interface Produit {
  id: number;
  nom: string;
}

interface InventaireItem {
  produitId: number;
  quantiteRestante: number;
  quantiteProduite: number | null;
  quantitePrevue: number | null;
}

export default function SaisieInventaire() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [inventaires, setInventaires] = useState<InventaireItem[]>([]);
  const [dateInventaire, setDateInventaire] = useState(
    new Date().toISOString().split('T')[0] // Format YYYY-MM-DD pour input date
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  // Charger les produits au démarrage
  useEffect(() => {
    loadProduits();
  }, []);

  const loadProduits = async () => {
    try {
      const response = await fetch('/api/produits');
      const data = await response.json();
      setProduits(data);
      
      // Initialiser un inventaire vide pour chaque produit
      const inventairesInitiaux = data.map((produit: Produit) => ({
        produitId: produit.id,
        quantiteRestante: 0,
        quantiteProduite: null,
        quantitePrevue: null,
      }));
      setInventaires(inventairesInitiaux);
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
    }
  };

  const updateInventaire = (produitId: number, field: keyof InventaireItem, value: number | null) => {
    setInventaires(prev => 
      prev.map(inv => 
        inv.produitId === produitId 
          ? { ...inv, [field]: value }
          : inv
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult('');

    try {
      // Filtrer seulement les inventaires avec des données saisies
      const inventairesValides = inventaires.filter(inv => 
        inv.quantiteRestante > 0 || (inv.quantiteProduite && inv.quantiteProduite > 0) || (inv.quantitePrevue && inv.quantitePrevue > 0)
      );

      if (inventairesValides.length === 0) {
        setResult('Aucune donnée d\'inventaire saisie.');
        setLoading(false);
        return;
      }

      // Ajouter la date à chaque inventaire
      const inventairesAvecDate = inventairesValides.map(inv => ({
        ...inv,
        dateInventaire
      }));

      const response = await fetch('/api/inventaires', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inventaires: inventairesAvecDate }),
      });

      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));

      if (response.ok) {
        // Réinitialiser le formulaire après succès
        const inventairesReset = inventaires.map(inv => ({
          ...inv,
          quantiteRestante: 0,
          quantiteProduite: null,
          quantitePrevue: null,
        }));
        setInventaires(inventairesReset);
      }
    } catch (error) {
      setResult('Erreur: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const getProduitNom = (produitId: number) => {
    const produit = produits.find(p => p.id === produitId);
    return produit ? produit.nom : `Produit ${produitId}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4 sm:py-8 sm:px-6 lg:px-8">
      {/* Header avec navigation */}
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <a 
            href="/" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4 text-sm sm:text-base"
          >
            ← Retour à l'accueil
          </a>
          <h1 className="text-2xl sm:text-3xl font-bold text-black">Saisie Inventaire Quotidien</h1>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 sm:p-6">
            <form onSubmit={handleSubmit}>
              {/* Sélection de la date */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-black mb-2">
                  Date d'inventaire
                </label>
                <input
                  type="date"
                  value={dateInventaire}
                  onChange={(e) => setDateInventaire(e.target.value)}
                  className="w-full sm:w-auto p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  required
                />
              </div>

              {/* Version Mobile : Cards */}
              <div className="block sm:hidden space-y-4 mb-6">
                {inventaires.map((inv) => (
                  <div key={inv.produitId} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h3 className="font-medium text-black mb-3 text-base">
                      {getProduitNom(inv.produitId)}
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-black mb-1">
                          Quantité Restante *
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={inv.quantiteRestante}
                          onChange={(e) => updateInventaire(inv.produitId, 'quantiteRestante', parseInt(e.target.value) || 0)}
                          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-black mb-1">
                          Quantité Produite (optionnel)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={inv.quantiteProduite || ''}
                          onChange={(e) => updateInventaire(inv.produitId, 'quantiteProduite', e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900"
                          placeholder="Optionnel"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-black mb-1">
                          Quantité Prévue pour demain (optionnel)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={inv.quantitePrevue || ''}
                          onChange={(e) => updateInventaire(inv.produitId, 'quantitePrevue', e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full p-3 border border-purple-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base text-gray-900"
                          placeholder="À prévoir demain"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Version Desktop : Tableau */}
              <div className="hidden sm:block overflow-x-auto mb-6">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                        Produit
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                        Quantité Restante *
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                        Quantité Produite
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">
                        Quantité Prévue (demain)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {inventaires.map((inv) => (
                      <tr key={inv.produitId} className="hover:bg-gray-50">
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-medium text-black">
                          {getProduitNom(inv.produitId)}
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            min="0"
                            value={inv.quantiteRestante}
                            onChange={(e) => updateInventaire(inv.produitId, 'quantiteRestante', parseInt(e.target.value) || 0)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            min="0"
                            value={inv.quantiteProduite || ''}
                            onChange={(e) => updateInventaire(inv.produitId, 'quantiteProduite', e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            placeholder="Optionnel"
                          />
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            min="0"
                            value={inv.quantitePrevue || ''}
                            onChange={(e) => updateInventaire(inv.produitId, 'quantitePrevue', e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full p-2 border border-purple-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                            placeholder="À prévoir demain"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Boutons d'action */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 font-medium text-base transition-colors"
                >
                  {loading ? 'Sauvegarde...' : 'Sauvegarder l\'inventaire'}
                </button>
                
                <button
                  type="button"
                  onClick={loadProduits}
                  className="w-full sm:w-auto bg-gray-500 text-white px-6 py-3 rounded-md hover:bg-gray-600 font-medium text-base transition-colors"
                >
                  Réinitialiser
                </button>
              </div>
            </form>

            {/* Résultat */}
            {result && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-medium text-black mb-2">Résultat:</h3>
                <pre className="bg-white p-3 rounded text-xs sm:text-sm overflow-auto max-h-40 sm:max-h-64 border border-gray-300">
                  {result}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 sm:mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2 text-base">Instructions:</h3>
          <ul className="text-blue-800 text-sm space-y-1">
            <li>• <strong>Quantité Restante</strong> : Nombre d'unités restantes en fin de journée (obligatoire)</li>
            <li>• <strong>Quantité Produite</strong> : Nombre d'unités produites dans la journée (optionnel)</li>
            <li>• Seuls les produits avec des quantités saisies seront enregistrés</li>
            <li>• Si un inventaire existe déjà pour cette date, il sera mis à jour</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
