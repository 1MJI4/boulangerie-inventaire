// test-api.js - Script de test pour l'API produits
const testAPI = async () => {
  try {
    console.log('Test 1: Ajouter des produits en masse...');
    
    const response = await fetch('http://localhost:3002/api/produits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        noms: 'Croissant, Pain de campagne, Tarte aux pommes, Baguette, Éclair au chocolat'
      })
    });
    
    const result = await response.json();
    console.log('Résultat POST:', result);
    
    console.log('\nTest 2: Récupérer la liste des produits...');
    
    const getResponse = await fetch('http://localhost:3002/api/produits');
    const produits = await getResponse.json();
    console.log('Produits:', produits);
    
  } catch (error) {
    console.error('Erreur:', error);
  }
};

testAPI();
