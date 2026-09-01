// src/lib/erreurBase.ts
//
// Un « 500 Impossible de charger les produits » ne dit pas si la base est
// injoignable, si les tables manquent ou si le mot de passe est faux. Ces
// trois pannes se règlent différemment, et en production on n'a pas la console
// du serveur sous les yeux. On renvoie donc un diagnostic — sans jamais
// exposer la chaîne de connexion ni le mot de passe.

import { Prisma } from '@prisma/client';

export type Diagnostic = { error: string; cause: string; quoiFaire: string };

export function diagnostiquer(e: unknown): Diagnostic {
  // Codes documentés par Prisma : ils désignent une situation, pas un secret.
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case 'P2021':
      case 'P2022':
        return {
          error: 'Les tables n’existent pas dans cette base.',
          cause: `Prisma ${e.code}`,
          quoiFaire:
            'Exécutez setup-supabase.sql dans le SQL Editor du projet Supabase pointé par DATABASE_URL.',
        };
      case 'P1001':
        return {
          error: 'La base ne répond pas.',
          cause: 'Prisma P1001',
          quoiFaire: 'Vérifiez l’hôte et le port de DATABASE_URL (pooler transaction, 6543).',
        };
      case 'P1000':
        return {
          error: 'Identifiants refusés par la base.',
          cause: 'Prisma P1000',
          quoiFaire: 'Vérifiez le mot de passe dans DATABASE_URL.',
        };
      case 'P1017':
        return {
          error: 'La base a fermé la connexion.',
          cause: 'Prisma P1017',
          quoiFaire: 'Ajoutez ?pgbouncer=true&connection_limit=1 à DATABASE_URL.',
        };
      default:
        return {
          error: 'Erreur de base de données.',
          cause: `Prisma ${e.code}`,
          quoiFaire: 'Consultez les journaux de fonctions pour le détail.',
        };
    }
  }

  if (e instanceof Prisma.PrismaClientInitializationError) {
    const message = e.message ?? '';
    if (/environment variable|DATABASE_URL/i.test(message)) {
      return {
        error: 'La configuration de la base est absente.',
        cause: 'DATABASE_URL non défini',
        quoiFaire:
          'Ajoutez DATABASE_URL, DIRECT_URL et CODE_GESTION dans les variables d’environnement de l’hébergeur, puis redéployez.',
      };
    }
    if (/Query Engine|binaryTarget|rhel/i.test(message)) {
      return {
        error: 'Le moteur Prisma manque pour cette plateforme.',
        cause: 'Query Engine introuvable',
        quoiFaire:
          'binaryTargets doit contenir "rhel-openssl-3.0.x", puis relancez un déploiement en vidant le cache.',
      };
    }
    return {
      error: 'La connexion à la base n’a pas pu s’initialiser.',
      cause: 'Initialisation Prisma',
      quoiFaire: 'Vérifiez DATABASE_URL et DIRECT_URL.',
    };
  }

  return {
    error: 'Erreur inattendue.',
    cause: e instanceof Error ? e.name : 'inconnue',
    quoiFaire: 'Consultez les journaux de fonctions.',
  };
}
