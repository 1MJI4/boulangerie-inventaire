import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4">
            🥐 Boulangerie Inventaire
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-gray-700 max-w-2xl mx-auto px-4">
            Système de gestion d'inventaire simple et efficace pour votre boulangerie
          </p>
        </div>

        {/* Navigation Cards - Mobile First */}
        <div className="space-y-4 sm:space-y-6 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6 max-w-6xl mx-auto">
          
          {/* Inventaire Vente */}
          <a
            href="/saisie-vendeur"
            className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 p-6 border-l-4 border-blue-500 active:bg-gray-50"
          >
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">📦</div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 sm:mb-3">
              Inventaire Vente
            </h2>
            <p className="text-gray-600 text-sm sm:text-base mb-3 sm:mb-4 leading-relaxed">
              Pour le vendeur : saisie des quantités restantes en fin de journée
            </p>
            <div className="text-blue-600 font-medium text-sm sm:text-base">
              Saisir vente →
            </div>
          </a>

          {/* Saisie Production */}
          <a
            href="/saisie-production"
            className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 p-6 border-l-4 border-green-500 active:bg-gray-50"
          >
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">🥖</div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 sm:mb-3">
              Saisie Production
            </h2>
            <p className="text-gray-600 text-sm sm:text-base mb-3 sm:mb-4 leading-relaxed">
              Pour le boulanger : enregistrement des quantités produites
            </p>
            <div className="text-green-600 font-medium text-sm sm:text-base">
              Saisir production →
            </div>
          </a>

          {/* Prévisions */}
          <a
            href="/saisie-prevue"
            className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 p-6 border-l-4 border-purple-500 active:bg-gray-50"
          >
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">🔮</div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 sm:mb-3">
              Prévisions
            </h2>
            <p className="text-gray-600 text-sm sm:text-base mb-3 sm:mb-4 leading-relaxed">
              Planification des quantités à produire pour demain
            </p>
            <div className="text-purple-600 font-medium text-sm sm:text-base">
              Planifier →
            </div>
          </a>
        </div>

        {/* Navigation Cards Secondaires */}
        <div className="mt-8 space-y-4 sm:space-y-6 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6 max-w-6xl mx-auto">
          
          {/* Planification de demain */}
          <a
            href="/planification-demain"
            className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 p-6 border-l-4 border-indigo-500 active:bg-gray-50"
          >
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">🌙</div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 sm:mb-3">
              Production de Nuit
            </h2>
            <p className="text-gray-600 text-sm sm:text-base mb-3 sm:mb-4 leading-relaxed">
              Consultez la liste des produits à préparer cette nuit
            </p>
            <div className="text-indigo-600 font-medium text-sm sm:text-base">
              Voir la planification →
            </div>
          </a>

          {/* Inventaire Complet */}
          <a
            href="/inventaire"
            className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 p-6 border-l-4 border-gray-500 active:bg-gray-50"
          >
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">📋</div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 sm:mb-3">
              Inventaire Complet
            </h2>
            <p className="text-gray-600 text-sm sm:text-base mb-3 sm:mb-4 leading-relaxed">
              Saisie complète avec tous les champs (mode avancé)
            </p>
            <div className="text-gray-600 font-medium text-sm sm:text-base">
              Mode avancé →
            </div>
          </a>

          {/* Dashboard */}
          <a
            href="/dashboard"
            className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 p-6 border-l-4 border-orange-500 active:bg-gray-50"
          >
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">📊</div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 sm:mb-3">
              Dashboard
            </h2>
            <p className="text-gray-600 text-sm sm:text-base mb-3 sm:mb-4 leading-relaxed">
              Consultez l'historique et les statistiques de vos inventaires
            </p>
            <div className="text-orange-600 font-medium text-sm sm:text-base">
              Voir le dashboard →
            </div>
          </a>
        </div>

        {/* Navigation Cards Gestion */}
        <div className="mt-8 space-y-4 sm:space-y-6 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6 max-w-4xl mx-auto">
          {/* Gestion Produits */}
          <a
            href="/test-api"
            className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 p-6 border-l-4 border-red-500 active:bg-gray-50"
          >
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">🛠️</div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 sm:mb-3">
              Gestion Produits
            </h2>
            <p className="text-gray-600 text-sm sm:text-base mb-3 sm:mb-4 leading-relaxed">
              Ajoutez et gérez la liste de vos produits de boulangerie
            </p>
            <div className="text-red-600 font-medium text-sm sm:text-base">
              Gérer les produits →
            </div>
          </a>

          {/* Historique Prévisions */}
          <a
            href="/historique-previsions"
            className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 p-6 border-l-4 border-indigo-500 active:bg-gray-50"
          >
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">📈</div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 sm:mb-3">
              Historique Prévisions
            </h2>
            <p className="text-gray-600 text-sm sm:text-base mb-3 sm:mb-4 leading-relaxed">
              Analysez la précision de vos planifications passées
            </p>
            <div className="text-indigo-600 font-medium text-sm sm:text-base">
              Voir l'historique →
            </div>
          </a>
        </div>

        {/* Features - Responsive Grid */}
        <div className="mt-12 sm:mt-16 lg:mt-20 max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-8 sm:mb-12">
            Fonctionnalités
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
            <div className="text-center bg-white p-4 sm:p-6 rounded-lg shadow-sm">
              <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">🔄</div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                Suivi Quotidien
              </h3>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                Enregistrement quotidien des stocks avec historique complet
              </p>
            </div>
            <div className="text-center bg-white p-4 sm:p-6 rounded-lg shadow-sm">
              <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">📈</div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                Statistiques
              </h3>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                Visualisation des tendances et alertes de rupture de stock
              </p>
            </div>
            <div className="text-center bg-white p-4 sm:p-6 rounded-lg shadow-sm">
              <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">⚡</div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                Interface Simple
              </h3>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                Interface intuitive adaptée au rythme de la boulangerie
              </p>
            </div>
            <div className="text-center bg-white p-4 sm:p-6 rounded-lg shadow-sm">
              <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">🔒</div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                Données Sécurisées
              </h3>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                Base de données PostgreSQL fiable et sécurisée
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
