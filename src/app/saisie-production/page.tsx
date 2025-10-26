'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Produit {
  id: number;
  nom: string;
}

interface ProductionItem {
  produitId: number;
  quantiteAjouter: number;
  quantiteActuelle: number;
}

export default function SaisieProduction() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [productions, setProductions] = useState<ProductionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inventairesExistants, setInventairesExistants] = useState<any[]>([]);

  useEffect(() => {
    chargerDonnees();
  }, []);

  const chargerDonnees = async () => {
    try {
      setLoading(true);
      
      // Charger produits
      const produitsResponse = await fetch('/api/produits');
      const produitsData: Produit[] = await produitsResponse.json();
      setProduits(produitsData);

      // Charger inventaires du jour pour connaître les quantités déjà produites
      const aujourdhui = new Date().toISOString().split('T')[0];
      const inventairesResponse = await fetch(`/api/inventaires?date=${aujourdhui}`);
      const inventairesData = await inventairesResponse.json();
      setInventairesExistants(inventairesData);

      // Initialiser les productions
      const productionsInit = produitsData.map(produit => {
        const inventaireExistant = inventairesData.find((inv: any) => inv.produitId === produit.id);
        return {
          produitId: produit.id,
          quantiteAjouter: 0,
          quantiteActuelle: inventaireExistant?.quantiteProduite || 0
        };
      });
      setProductions(productionsInit);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProduction = (produitId: number, quantiteAjouter: number) => {
    setProductions(prev => prev.map(p => 
      p.produitId === produitId 
        ? { ...p, quantiteAjouter } 
        : p
    ));
  };

  const getProduitNom = (produitId: number) => {
    return produits.find(p => p.id === produitId)?.nom || 'Produit inconnu';
  };

  const ajouterQuantiteRapide = (produitId: number, quantite: number) => {
    setProductions(prev => prev.map(p => 
      p.produitId === produitId 
        ? { ...p, quantiteAjouter: p.quantiteAjouter + quantite } 
        : p
    ));
  };

  const sauvegarderProductions = async () => {
    try {
      setSaving(true);
      
      // Filtrer seulement les productions avec des quantités à ajouter
      const productionsAEnvoyer = productions
        .filter(p => p.quantiteAjouter > 0)
        .map(p => ({
          produitId: p.produitId,
          quantiteRestante: inventairesExistants.find(inv => inv.produitId === p.produitId)?.quantiteRestante || 0,
          quantiteProduite: p.quantiteAjouter,
          modeAddition: true // Mode addition activé
        }));

      if (productionsAEnvoyer.length === 0) {
        alert('Aucune quantité à ajouter');
        return;
      }

      const response = await fetch('/api/inventaires', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventaires: productionsAEnvoyer })
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(`✅ Production ajoutée avec succès!\n${result.success} produit(s) mis à jour`);
        // Recharger les données pour voir les nouvelles quantités
        await chargerDonnees();
      } else {
        throw new Error(result.error || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('❌ Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const resetProductions = () => {
    setProductions(prev => prev.map(p => ({ ...p, quantiteAjouter: 0 })));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
                👨‍🍳 Saisie Production
              </h1>
              <p className="text-gray-600">
                Ajoutez les quantités produites (mode addition)
              </p>
            </div>
            <Link 
              href="/"
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm font-medium"
            >
              ← Retour
            </Link>
          </div>
        </div>

        {/* Saisie Mobile */}
        <div className="block sm:hidden space-y-4 mb-6">
          {productions.map((prod) => (
            <div key={prod.produitId} className="bg-white rounded-lg shadow-md p-4">
              <div className="mb-3">
                <h3 className="font-semibold text-gray-800 text-lg mb-1">
                  {getProduitNom(prod.produitId)}
                </h3>
                <p className="text-sm text-gray-600">
                  Déjà produit aujourd'hui: <span className="font-medium text-green-600">{prod.quantiteActuelle}</span>
                </p>
              </div>
              
              {/* Boutons rapides */}
              <div className="flex gap-2 mb-3">
                {[1, 2, 5, 10].map(qty => (
                  <button
                    key={qty}
                    onClick={() => ajouterQuantiteRapide(prod.produitId, qty)}
                    className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded-md text-sm font-medium transition-colors"
                  >
                    +{qty}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 w-16">Ajouter:</span>
                <input
                  type="number"
                  min="0"
                  value={prod.quantiteAjouter}
                  onChange={(e) => updateProduction(prod.produitId, parseInt(e.target.value) || 0)}
                  className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center font-bold text-lg text-gray-900"
                  placeholder="0"
                />
              </div>
              
              {prod.quantiteAjouter > 0 && (
                <div className="mt-2 p-2 bg-green-50 rounded-md">
                  <p className="text-sm text-green-700">
                    Total après ajout: <span className="font-bold">{prod.quantiteActuelle + prod.quantiteAjouter}</span>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Saisie Desktop */}
        <div className="hidden sm:block overflow-x-auto mb-6">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-green-500 to-blue-600 text-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Produit
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                    Déjà Produit
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                    Ajout Rapide
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                    Quantité à Ajouter
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                    Total Après Ajout
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {productions.map((prod) => (
                  <tr key={prod.produitId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {getProduitNom(prod.produitId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm font-medium">
                        {prod.quantiteActuelle}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center gap-1">
                        {[1, 2, 5, 10].map(qty => (
                          <button
                            key={qty}
                            onClick={() => ajouterQuantiteRapide(prod.produitId, qty)}
                            className="bg-green-100 hover:bg-green-200 text-green-800 px-2 py-1 rounded text-xs font-medium transition-colors"
                          >
                            +{qty}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <input
                        type="number"
                        min="0"
                        value={prod.quantiteAjouter}
                        onChange={(e) => updateProduction(prod.produitId, parseInt(e.target.value) || 0)}
                        className="w-20 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 text-center font-bold text-gray-900"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 rounded-full text-sm font-bold ${
                        prod.quantiteAjouter > 0 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {prod.quantiteActuelle + prod.quantiteAjouter}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="text-sm text-gray-600">
              💡 Les quantités s'ajoutent à celles déjà produites aujourd'hui
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetProductions}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200"
              >
                🔄 Reset
              </button>
              <button
                onClick={sauvegarderProductions}
                disabled={saving || productions.every(p => p.quantiteAjouter === 0)}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors duration-200 font-medium"
              >
                {saving ? 'Sauvegarde...' : '💾 Ajouter à la Production'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
